const { app, pool, request, PNG_1X1, crearUsuario, crearPost, crearComentario } = require('./helpers');

async function notificaciones(usuario, query = '') {
    const res = await usuario.auth(request(app).get(`/api/notificaciones?limit=50${query}`));
    return res.body;
}

describe('RF03 comentarios y respuestas', () => {
    let autor, otro, post;
    beforeAll(async () => {
        autor = await crearUsuario('cautor');
        otro = await crearUsuario('cotro');
        post = await crearPost(autor);
    });

    test('comenta, valida longitud y muestra autor y fecha', async () => {
        const c = await crearComentario(otro, post.id, { contenido: 'Hola mundo' });
        expect(c).toMatchObject({ contenido: 'Hola mundo', usernameUsuario: otro.username, respuestas: [] });
        expect(c.fechaCreacion).toBeTruthy();

        for (const contenido of ['', '   ', 'x'.repeat(501), 123]) {
            await otro.auth(request(app).post(`/api/posts/${post.id}/comentarios`)).send({ contenido }).expect(400);
        }
        await otro.auth(request(app).post('/api/posts/99999999/comentarios')).send({ contenido: 'x' }).expect(404);
        await request(app).post(`/api/posts/${post.id}/comentarios`).send({ contenido: 'x' }).expect(401);
    });

    test('comentario con imagen valida', async () => {
        const res = await otro.auth(request(app).post(`/api/posts/${post.id}/comentarios`))
            .field('contenido', 'con foto').attach('imagen', PNG_1X1, { filename: 'a.png', contentType: 'image/png' });
        expect(res.status).toBe(201);
        expect(res.body.imagenUrl).toMatch(/^\/uploads\//);
    });

    test('responder a un comentario funciona (un nivel)', async () => {
        const raiz = await crearComentario(autor, post.id, { contenido: 'raiz' });
        const resp = await otro.auth(request(app).post(`/api/comentarios/${raiz.id}/respuestas`)).send({ contenido: 'respuesta' });
        expect(resp.status).toBe(201);
        expect(resp.body.comentarioPadreId).toBe(raiz.id);

        const lista = await request(app).get(`/api/posts/${post.id}/comentarios`);
        const encontrado = lista.body.comentarios.find((c) => c.id === raiz.id);
        expect(encontrado.respuestas.map((r) => r.contenido)).toEqual(['respuesta']);
    });

    test('NO se puede responder a una respuesta (API y trigger de BD)', async () => {
        const raiz = await crearComentario(autor, post.id);
        const resp = await crearComentario(otro, post.id, { comentarioPadreId: raiz.id });

        const viaRuta = await autor.auth(request(app).post(`/api/comentarios/${resp.id}/respuestas`)).send({ contenido: 'nieto' });
        expect(viaRuta.status).toBe(400);
        const viaBody = await autor.auth(request(app).post(`/api/posts/${post.id}/comentarios`))
            .send({ contenido: 'nieto', comentarioPadreId: resp.id });
        expect(viaBody.status).toBe(400);

        // aunque alguien se salte la API, la BD lo impide
        await expect(pool.query(
            'INSERT INTO comentarios (contenido, usuario_id, post_id, comentario_padre_id) VALUES (?, ?, ?, ?)',
            ['directo', autor.id, post.id, resp.id])).rejects.toThrow(/responder a una respuesta/);
    });

    test('el padre debe ser del mismo post', async () => {
        const otroPost = await crearPost(autor);
        const raiz = await crearComentario(autor, otroPost.id);
        const res = await autor.auth(request(app).post(`/api/posts/${post.id}/comentarios`))
            .send({ contenido: 'cruzado', comentarioPadreId: raiz.id });
        expect(res.status).toBe(400);
        await expect(pool.query(
            'INSERT INTO comentarios (contenido, usuario_id, post_id, comentario_padre_id) VALUES (?, ?, ?, ?)',
            ['directo', autor.id, post.id, raiz.id])).rejects.toThrow();
    });

    test('editar y borrar: solo el autor (borrar tambien el admin); borrar la raiz borra sus respuestas', async () => {
        const raiz = await crearComentario(otro, post.id, { contenido: 'original' });
        const resp = await crearComentario(autor, post.id, { comentarioPadreId: raiz.id });

        await autor.auth(request(app).put(`/api/comentarios/${raiz.id}`)).send({ contenido: 'hack' }).expect(403);
        const ed = await otro.auth(request(app).put(`/api/comentarios/${raiz.id}`)).send({ contenido: 'cambiado' });
        expect(ed.body).toMatchObject({ contenido: 'cambiado', editado: true });
        await otro.auth(request(app).put(`/api/comentarios/${raiz.id}`)).send({ contenido: 'x'.repeat(501) }).expect(400);

        await autor.auth(request(app).delete(`/api/comentarios/${raiz.id}`)).expect(403);
        await otro.auth(request(app).delete(`/api/comentarios/${raiz.id}`)).expect(200);
        const [rows] = await pool.query('SELECT id FROM comentarios WHERE id IN (?)', [[raiz.id, resp.id]]);
        expect(rows).toHaveLength(0);
    });

    test('lista paginada de comentarios raiz', async () => {
        const p = await crearPost(autor);
        for (let i = 0; i < 5; i++) await crearComentario(otro, p.id, { contenido: `c${i}` });
        const res = await request(app).get(`/api/posts/${p.id}/comentarios?limit=2&page=2`);
        expect(res.body.comentarios.map((c) => c.contenido)).toEqual(['c2', 'c3']);
        expect(res.body.paginacion).toMatchObject({ total: 5, paginas: 3 });
    });
});

describe('RF04 likes', () => {
    let autor, fan, post, comentario;
    beforeAll(async () => {
        autor = await crearUsuario('lautor');
        fan = await crearUsuario('lfan');
        post = await crearPost(autor);
        comentario = await crearComentario(autor, post.id);
    });

    test('da y quita like en posts y comentarios con contador', async () => {
        let r = await fan.auth(request(app).post(`/api/posts/${post.id}/like`));
        expect(r.body).toEqual({ likes: 1, likedByMe: true });
        r = await fan.auth(request(app).post(`/api/posts/${post.id}/like`));
        expect(r.body).toEqual({ likes: 0, likedByMe: false });

        r = await fan.auth(request(app).post(`/api/comentarios/${comentario.id}/like`));
        expect(r.body).toEqual({ likes: 1, likedByMe: true });

        const detalle = await fan.auth(request(app).get(`/api/posts/${post.id}/comentarios`));
        expect(detalle.body.comentarios[0]).toMatchObject({ likes: 1, likedByMe: true });
        await fan.auth(request(app).post(`/api/comentarios/${comentario.id}/like`));
    });

    test('post o comentario inexistente da 404; sin sesion 401', async () => {
        await fan.auth(request(app).post('/api/posts/99999999/like')).expect(404);
        await fan.auth(request(app).post('/api/comentarios/99999999/like')).expect(404);
        await fan.auth(request(app).post('/api/posts/abc/like')).expect(400);
        await request(app).post(`/api/posts/${post.id}/like`).expect(401);
    });

    test('likes simultaneos del mismo usuario nunca duplican (PK en BD)', async () => {
        const p = await crearPost(autor);
        const respuestas = await Promise.all(
            Array.from({ length: 12 }, () => fan.auth(request(app).post(`/api/posts/${p.id}/like`))));
        respuestas.forEach((r) => expect(r.status).toBe(200));
        const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM post_likes WHERE post_id = ? AND usuario_id = ?', [p.id, fan.id]);
        expect(n).toBeLessThanOrEqual(1);
        respuestas.forEach((r) => expect(r.body.likes).toBeLessThanOrEqual(1));

        // y la BD rechaza el duplicado directo
        await pool.query('INSERT IGNORE INTO post_likes (post_id, usuario_id) VALUES (?, ?)', [p.id, fan.id]);
        await expect(pool.query('INSERT INTO post_likes (post_id, usuario_id) VALUES (?, ?)', [p.id, fan.id]))
            .rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
    });
});

describe('RF06 seguidores', () => {
    let a, b, c;
    beforeAll(async () => {
        a = await crearUsuario('sa');
        b = await crearUsuario('sb');
        c = await crearUsuario('sc');
    });

    test('seguir / dejar de seguir con contadores', async () => {
        let r = await a.auth(request(app).post(`/api/users/${b.id}/seguir`));
        expect(r.body).toMatchObject({ siguiendo: true, seguidores: 1 });
        await c.auth(request(app).post(`/api/users/${b.id}/seguir`));

        let perfil = await a.auth(request(app).get(`/api/users/${b.id}`));
        expect(perfil.body).toMatchObject({ seguidores: 2, seguidos: 0, siguiendo: true });
        const propio = await a.auth(request(app).get('/api/users/me'));
        expect(propio.body.seguidos).toBe(1);

        r = await a.auth(request(app).post(`/api/users/${b.id}/seguir`));
        expect(r.body).toMatchObject({ siguiendo: false, seguidores: 1 });
    });

    test('no se puede seguir a uno mismo (API y BD)', async () => {
        const r = await a.auth(request(app).post(`/api/users/${a.id}/seguir`));
        expect(r.status).toBe(400);
        await expect(pool.query('INSERT INTO seguidores (seguidor_id, seguido_id) VALUES (?, ?)', [a.id, a.id]))
            .rejects.toThrow(/seguirte a ti mismo/);
    });

    test('id inexistente o invalido', async () => {
        await a.auth(request(app).post('/api/users/99999999/seguir')).expect(404);
        await a.auth(request(app).post('/api/users/abc/seguir')).expect(400);
        await a.auth(request(app).post('/api/users/-3/seguir')).expect(400);
        await request(app).post(`/api/users/${b.id}/seguir`).expect(401);
    });

    test('seguimientos simultaneos no duplican', async () => {
        const x = await crearUsuario('sx');
        const y = await crearUsuario('sy');
        const rs = await Promise.all(Array.from({ length: 10 }, () => x.auth(request(app).post(`/api/users/${y.id}/seguir`))));
        rs.forEach((r) => expect(r.status).toBe(200));
        const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM seguidores WHERE seguidor_id = ? AND seguido_id = ?', [x.id, y.id]);
        expect(n).toBeLessThanOrEqual(1);
    });

    test('lista seguidores y seguidos', async () => {
        const seg = await a.auth(request(app).get(`/api/users/${b.id}/seguidores`));
        expect(seg.body.usuarios.map((u) => u.username)).toEqual([c.username]);
        const sig = await c.auth(request(app).get(`/api/users/${c.id}/seguidos`));
        expect(sig.body.usuarios.map((u) => u.username)).toEqual([b.username]);
    });
});

describe('RF09 guardados', () => {
    let dueño, otro, post;
    beforeAll(async () => {
        dueño = await crearUsuario('gd');
        otro = await crearUsuario('go');
        post = await crearPost(otro);
    });

    test('guarda, quita y lista; es privado', async () => {
        let r = await dueño.auth(request(app).post(`/api/posts/${post.id}/guardar`));
        expect(r.body.guardado).toBe(true);

        const mios = await dueño.auth(request(app).get('/api/users/me/guardados'));
        expect(mios.body.posts.map((p) => p.id)).toEqual([post.id]);
        expect(mios.body.posts[0].guardado).toBe(true);

        const ajenos = await otro.auth(request(app).get('/api/users/me/guardados'));
        expect(ajenos.body.posts).toHaveLength(0);
        // no existe forma de ver los guardados de otro
        await otro.auth(request(app).get(`/api/users/${dueño.id}/guardados`)).expect(404);

        r = await dueño.auth(request(app).post(`/api/posts/${post.id}/guardar`));
        expect(r.body.guardado).toBe(false);
    });

    test('post inexistente y guardados simultaneos', async () => {
        await dueño.auth(request(app).post('/api/posts/99999999/guardar')).expect(404);
        const rs = await Promise.all(Array.from({ length: 8 }, () => dueño.auth(request(app).post(`/api/posts/${post.id}/guardar`))));
        rs.forEach((r) => expect(r.status).toBe(200));
        const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM guardados WHERE usuario_id = ? AND post_id = ?', [dueño.id, post.id]);
        expect(n).toBeLessThanOrEqual(1);
    });
});

describe('RF05 perfiles y RF12 insignias', () => {
    test('edita biografia, programa y nombre con validacion; el perfil publico no trae correo', async () => {
        const u = await crearUsuario('perfil');
        const ok = await u.auth(request(app).put('/api/users/me')).send({ nombre: 'Nuevo Nombre', biografia: 'Hola', programaAcademico: 'Sistemas' });
        expect(ok.status).toBe(200);
        expect(ok.body).toMatchObject({ nombre: 'Nuevo Nombre', biografia: 'Hola', programaAcademico: 'Sistemas' });

        await u.auth(request(app).put('/api/users/me')).send({ biografia: 'x'.repeat(201) }).expect(400);
        await u.auth(request(app).put('/api/users/me')).send({ programaAcademico: 'x'.repeat(81) }).expect(400);

        const otro = await crearUsuario('mira');
        const vista = await otro.auth(request(app).get(`/api/users/${u.id}`));
        expect(vista.body).toMatchObject({ biografia: 'Hola', programaAcademico: 'Sistemas', esMio: false });
        expect(vista.body.correo).toBeUndefined();
        expect(JSON.stringify(vista.body)).not.toContain(u.correo);
        await otro.auth(request(app).get('/api/users/99999999')).expect(404);
    });

    test('insignia Popular con 10 likes y Activo con 10 comentarios', async () => {
        const estrella = await crearUsuario('estrella');
        const post = await crearPost(estrella);
        const fans = await Promise.all(Array.from({ length: 10 }, (_, i) => crearUsuario(`fan${i}`)));

        let perfil = await fans[0].auth(request(app).get(`/api/users/${estrella.id}`));
        expect(perfil.body.insignias).toEqual([]);

        for (const f of fans.slice(0, 9)) await f.auth(request(app).post(`/api/posts/${post.id}/like`));
        perfil = await fans[0].auth(request(app).get(`/api/users/${estrella.id}`));
        expect(perfil.body.insignias).not.toContain('Popular');

        await fans[9].auth(request(app).post(`/api/posts/${post.id}/like`));
        perfil = await fans[0].auth(request(app).get(`/api/users/${estrella.id}`));
        expect(perfil.body.insignias).toContain('Popular');
        expect(perfil.body.estadisticas).toMatchObject({ posts: 1, likesRecibidos: 10 });

        const activo = await crearUsuario('activo');
        for (let i = 0; i < 10; i++) await crearComentario(activo, post.id, { contenido: `c${i}` });
        perfil = await fans[0].auth(request(app).get(`/api/users/${activo.id}`));
        expect(perfil.body.insignias).toContain('Activo');
        expect(perfil.body.estadisticas.comentarios).toBe(10);
    });

    test('likes en un post anonimo no dan insignia Popular publica', async () => {
        const autor = await crearUsuario('anonpop');
        const post = await crearPost(autor, { esAnonimo: true });
        const fans = await Promise.all(Array.from({ length: 10 }, (_, i) => crearUsuario(`af${i}`)));
        for (const f of fans) await f.auth(request(app).post(`/api/posts/${post.id}/like`));
        const perfil = await fans[0].auth(request(app).get(`/api/users/${autor.id}`));
        expect(perfil.body.insignias).toEqual([]);
        expect(perfil.body.estadisticas.likesRecibidos).toBe(0);
    });
});

describe('RF07 notificaciones y RF12 menciones', () => {
    test('comentario, like, seguidor generan aviso al destinatario', async () => {
        const autor = await crearUsuario('nautor');
        const actor = await crearUsuario('nactor');
        const post = await crearPost(autor);

        await actor.auth(request(app).post(`/api/posts/${post.id}/like`));
        await crearComentario(actor, post.id);
        await actor.auth(request(app).post(`/api/users/${autor.id}/seguir`));

        const res = await notificaciones(autor);
        expect(res.notificaciones.map((n) => n.tipo).sort()).toEqual(['comentario', 'like', 'seguidor']);
        expect(res.noLeidas).toBe(3);
        res.notificaciones.forEach((n) => {
            expect(n.mensaje.length).toBeLessThanOrEqual(150);
            expect(n.mensaje).toContain(`@${actor.username}`);
        });
    });

    test('no te notificas a ti mismo (comentar o likear lo tuyo)', async () => {
        const u = await crearUsuario('yomismo');
        const post = await crearPost(u);
        await u.auth(request(app).post(`/api/posts/${post.id}/like`));
        await crearComentario(u, post.id);
        const res = await notificaciones(u);
        expect(res.notificaciones).toHaveLength(0);
    });

    test('like / quitar / like no duplica la notificacion', async () => {
        const autor = await crearUsuario('dedup');
        const actor = await crearUsuario('dedupa');
        const post = await crearPost(autor);
        for (let i = 0; i < 4; i++) await actor.auth(request(app).post(`/api/posts/${post.id}/like`));
        const res = await notificaciones(autor);
        expect(res.notificaciones.filter((n) => n.tipo === 'like')).toHaveLength(1);
    });

    test('marcar leida / no leida, marcar todas, y no tocar las de otro', async () => {
        const autor = await crearUsuario('leer');
        const actor = await crearUsuario('leera');
        const post = await crearPost(autor);
        await actor.auth(request(app).post(`/api/posts/${post.id}/like`));
        await crearComentario(actor, post.id);

        const lista = (await notificaciones(autor)).notificaciones;
        const id = lista[0].id;
        await autor.auth(request(app).patch(`/api/notificaciones/${id}`)).send({ leido: true }).expect(200);
        expect((await notificaciones(autor)).noLeidas).toBe(1);
        await autor.auth(request(app).patch(`/api/notificaciones/${id}`)).send({ leido: false }).expect(200);
        expect((await notificaciones(autor)).noLeidas).toBe(2);

        await actor.auth(request(app).patch(`/api/notificaciones/${id}`)).send({ leido: true }).expect(404);
        await autor.auth(request(app).patch('/api/notificaciones/99999999')).send({ leido: true }).expect(404);

        await autor.auth(request(app).post('/api/notificaciones/leer-todas')).expect(200);
        const res = await notificaciones(autor, '&soloNoLeidas=true');
        expect(res.notificaciones).toHaveLength(0);
        expect(res.noLeidas).toBe(0);
    });

    test('responder avisa al autor del comentario', async () => {
        const dueñoPost = await crearUsuario('rp');
        const comentarista = await crearUsuario('rc');
        const respondedor = await crearUsuario('rr');
        const post = await crearPost(dueñoPost);
        const c = await crearComentario(comentarista, post.id);
        await respondedor.auth(request(app).post(`/api/comentarios/${c.id}/respuestas`)).send({ contenido: 'resp' }).expect(201);
        const res = await notificaciones(comentarista);
        expect(res.notificaciones.some((n) => n.mensaje.includes('respondió tu comentario'))).toBe(true);
    });

    test('mencion @username en post y comentario notifica; sin duplicar al editar; ignora auto-mencion', async () => {
        const mencionado = await crearUsuario('mencionado');
        const autor = await crearUsuario('menciona');
        const post = await crearPost(autor, { contenido: `hola @${mencionado.username} y @${autor.username} y @noexiste_zz` });
        await crearComentario(autor, post.id, { contenido: `otra vez @${mencionado.username.toUpperCase()}` });
        await autor.auth(request(app).put(`/api/posts/${post.id}`)).send({ titulo: 'T editado', contenido: `hola de nuevo @${mencionado.username}` }).expect(200);

        const res = await notificaciones(mencionado);
        const menciones = res.notificaciones.filter((n) => n.tipo === 'mencion');
        expect(menciones).toHaveLength(2); // una por el post (aunque se edito) y una por el comentario
        expect((await notificaciones(autor)).notificaciones.filter((n) => n.tipo === 'mencion')).toHaveLength(0);
    });

    test('mencion desde un post anonimo no revela quien lo escribio', async () => {
        const mencionado = await crearUsuario('mencanon');
        const autor = await crearUsuario('autoranon');
        await crearPost(autor, { esAnonimo: true, contenido: `secreto para @${mencionado.username}` });
        const res = await notificaciones(mencionado);
        expect(res.notificaciones).toHaveLength(1);
        expect(JSON.stringify(res)).not.toContain(autor.username);
    });
});
