const fs = require('fs');
const path = require('path');
const { app, pool, request, PNG_1X1, crearUsuario, loginAdmin, crearPost } = require('./helpers');

const uploads = process.env.UPLOADS_DIR;

describe('RF02 / RF10 / RF11 posts, etiquetas y anonimato', () => {
    let autor, otro;
    beforeAll(async () => {
        autor = await crearUsuario('autor');
        otro = await crearUsuario('otro');
    });

    test('crea un post con etiquetas normalizadas', async () => {
        const post = await crearPost(autor, { tags: ['#Examen', 'FISICA'] });
        expect(post.tags).toEqual(['examen', 'fisica']);
        expect(post.usernameUsuario).toBe(autor.username);
        expect(post.editado).toBe(false);
    });

    test('valida titulo, contenido, categoria y tipos', async () => {
        const casos = [
            { titulo: 'x'.repeat(121) },
            { contenido: 'x'.repeat(3001) },
            { titulo: '' },
            { categoriaId: 999 },
            { categoriaId: 'abc' },
            { titulo: { $ne: 1 } }
        ];
        for (const caso of casos) {
            const res = await autor.auth(request(app).post('/api/posts'))
                .send({ titulo: 'T', contenido: 'C', categoriaId: 4, ...caso });
            expect(res.status).toBe(400);
        }
        await request(app).post('/api/posts').send({ titulo: 'T', contenido: 'C', categoriaId: 4 }).expect(401);
    });

    test('mas de 3 etiquetas se rechaza (no se recorta); espacios y simbolos tambien', async () => {
        const malos = [['a', 'b', 'c', 'd'], ['con espacio'], ['x'.repeat(31)], ['mal!']];
        for (const tags of malos) {
            const res = await autor.auth(request(app).post('/api/posts'))
                .send({ titulo: 'T', contenido: 'C', categoriaId: 4, tags });
            expect(res.status).toBe(400);
        }
        // duplicados tras normalizar cuentan una sola vez
        const ok = await crearPost(autor, { tags: ['uno', '#UNO', 'dos', 'tres'] });
        expect(ok.tags).toEqual(['dos', 'tres', 'uno']);
    });

    test('tags como texto separado por comas (multipart)', async () => {
        const res = await autor.auth(request(app).post('/api/posts'))
            .field('titulo', 'Con form').field('contenido', 'c').field('categoriaId', '4').field('tags', 'uno, dos')
            .attach('imagen', PNG_1X1, { filename: 'a.png', contentType: 'image/png' });
        expect(res.status).toBe(201);
        expect(res.body.tags).toEqual(['dos', 'uno']);
        expect(res.body.imagenUrl).toMatch(/^\/uploads\//);
    });

    test('la BD tambien limita a 3 etiquetas por post (trigger)', async () => {
        const post = await crearPost(autor, { tags: ['t1', 't2', 't3'] });
        const [[tag]] = await pool.query("SELECT id FROM tags WHERE nombre = 't1'");
        await pool.query('INSERT INTO tags (nombre) VALUES (?)', [`extra${Date.now()}`.slice(0, 30)]);
        const [[extra]] = await pool.query('SELECT id FROM tags ORDER BY id DESC LIMIT 1');
        await expect(pool.query('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)', [post.id, extra.id]))
            .rejects.toThrow(/Maximo 3 etiquetas/);
        expect(tag.id).toBeTruthy();
    });

    test('creacion concurrente con la misma etiqueta nueva no falla', async () => {
        const tag = `carrera${Date.now().toString(36)}`;
        const respuestas = await Promise.all(Array.from({ length: 6 }, () =>
            autor.auth(request(app).post('/api/posts')).send({ titulo: 'T', contenido: 'C', categoriaId: 4, tags: [tag] })));
        respuestas.forEach((r) => expect(r.status).toBe(201));
        const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM tags WHERE nombre = ?', [tag]);
        expect(total).toBe(1);
    });

    test('solo el autor edita; queda marcado como editado', async () => {
        const post = await crearPost(autor);
        const ajeno = await otro.auth(request(app).put(`/api/posts/${post.id}`)).send({ titulo: 'Hack', contenido: 'x' });
        expect(ajeno.status).toBe(403);

        const res = await autor.auth(request(app).put(`/api/posts/${post.id}`)).send({ titulo: 'Nuevo', contenido: 'Editado', tags: ['otra'] });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ titulo: 'Nuevo', editado: true, tags: ['otra'] });
        expect(res.body.editadoAt).toBeTruthy();
    });

    test('autor o admin eliminan; otro usuario no; el admin deja auditoria', async () => {
        const post = await crearPost(autor);
        await otro.auth(request(app).delete(`/api/posts/${post.id}`)).expect(403);
        await autor.auth(request(app).delete(`/api/posts/${post.id}`)).expect(200);
        await request(app).get(`/api/posts/${post.id}`).expect(404);

        const admin = await loginAdmin();
        const otroPost = await crearPost(autor);
        await admin.auth(request(app).delete(`/api/posts/${otroPost.id}`)).expect(200);
        const [rows] = await pool.query("SELECT * FROM auditoria_admin WHERE accion = 'eliminar_post' AND entidad_id = ?", [otroPost.id]);
        expect(rows).toHaveLength(1);
    });

    test('borrar un post borra la imagen del disco y en cascada comentarios, likes y guardados', async () => {
        const res = await autor.auth(request(app).post('/api/posts'))
            .field('titulo', 'Con imagen').field('contenido', 'c').field('categoriaId', '4')
            .attach('imagen', PNG_1X1, { filename: 'a.png', contentType: 'image/png' });
        const id = res.body.id;
        const archivo = path.join(uploads, path.basename(res.body.imagenUrl));
        expect(fs.existsSync(archivo)).toBe(true);

        await otro.auth(request(app).post(`/api/posts/${id}/like`));
        await otro.auth(request(app).post(`/api/posts/${id}/guardar`));
        await otro.auth(request(app).post(`/api/posts/${id}/comentarios`)).send({ contenido: 'hola' });

        await autor.auth(request(app).delete(`/api/posts/${id}`)).expect(200);
        await new Promise((r) => setTimeout(r, 100));
        expect(fs.existsSync(archivo)).toBe(false);
        for (const t of ['post_likes', 'guardados', 'comentarios']) {
            const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM ${t} WHERE post_id = ?`, [id]);
            expect(n).toBe(0);
        }
    });
});

describe('RNF03 subida de archivos', () => {
    let u;
    beforeAll(async () => { u = await crearUsuario('subida'); });

    const subir = (buffer, nombre = 'a.png', tipo = 'image/png', ruta = '/api/posts') =>
        u.auth(request(app).post(ruta)).field('titulo', 'T').field('contenido', 'C').field('categoriaId', '4')
            .attach('imagen', buffer, { filename: nombre, contentType: tipo });

    test('rechaza archivos con MIME falso y no deja nada en disco', async () => {
        const antes = fs.readdirSync(uploads).length;
        const res = await subir(Buffer.from('esto es texto, no una imagen'));
        expect(res.status).toBe(400);
        const exe = await subir(Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200)]), 'virus.png', 'image/png');
        expect(exe.status).toBe(400);
        expect(fs.readdirSync(uploads).length).toBe(antes);
    });

    test('acepta GIF en posts pero no en comentarios', async () => {
        const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        await subir(gif, 'a.gif', 'image/gif').expect(201);

        const post = await crearPost(u);
        const res = await u.auth(request(app).post(`/api/posts/${post.id}/comentarios`))
            .field('contenido', 'gif').attach('imagen', gif, { filename: 'a.gif', contentType: 'image/gif' });
        expect(res.status).toBe(400);
    });

    test('respeta los limites 5 MB (post) y 3 MB (comentario) y 2 MB (perfil)', async () => {
        const relleno = (mb) => Buffer.concat([PNG_1X1, Buffer.alloc(mb * 1024 * 1024)]);
        expect((await subir(relleno(6))).status).toBe(413);
        expect((await subir(relleno(4))).status).toBe(201);

        const post = await crearPost(u);
        const c = await u.auth(request(app).post(`/api/posts/${post.id}/comentarios`))
            .field('contenido', 'grande').attach('imagen', relleno(4), { filename: 'a.png', contentType: 'image/png' });
        expect(c.status).toBe(413);

        const p = await u.auth(request(app).put('/api/users/me')).field('nombre', 'Nombre')
            .attach('foto', relleno(3), { filename: 'a.png', contentType: 'image/png' });
        expect(p.status).toBe(413);
    });

    test('si la insercion falla se borra el archivo ya guardado', async () => {
        const antes = fs.readdirSync(uploads).length;
        const res = await u.auth(request(app).post('/api/posts'))
            .field('titulo', 'T').field('contenido', 'C').field('categoriaId', '999')
            .attach('imagen', PNG_1X1, { filename: 'a.png', contentType: 'image/png' });
        expect(res.status).toBe(400);
        await new Promise((r) => setTimeout(r, 100));
        expect(fs.readdirSync(uploads).length).toBe(antes);
    });
});

describe('RF11 anonimato', () => {
    let autor, lector, admin, anonimo;
    beforeAll(async () => {
        autor = await crearUsuario('anon');
        lector = await crearUsuario('lector');
        admin = await loginAdmin();
        anonimo = await crearPost(autor, { esAnonimo: true, titulo: 'Secreto anonimo zzqx', tags: ['secreto'] });
    });

    const sinAutor = (post) => {
        expect(post.usuarioId).toBeNull();
        expect(post.nombreUsuario).toBe('Anónimo');
        expect(post.usernameUsuario).toBe('');
        expect(post.autorReal).toBeUndefined();
    };

    test('la respuesta de creacion, el detalle y el feed no exponen al autor', async () => {
        sinAutor(anonimo);
        const detalle = await lector.auth(request(app).get(`/api/posts/${anonimo.id}`));
        sinAutor(detalle.body);
        const publico = await request(app).get(`/api/posts/${anonimo.id}`);
        sinAutor(publico.body);
        expect(JSON.stringify(publico.body)).not.toContain(autor.username);

        const feed = await lector.auth(request(app).get('/api/posts?limit=20&tag=secreto'));
        const encontrado = feed.body.posts.find((p) => p.id === anonimo.id);
        sinAutor(encontrado);
        expect(JSON.stringify(feed.body)).not.toContain(autor.username);
    });

    test('esMio solo es verdadero para el propio autor', async () => {
        const mio = await autor.auth(request(app).get(`/api/posts/${anonimo.id}`));
        expect(mio.body.esMio).toBe(true);
        const ajeno = await lector.auth(request(app).get(`/api/posts/${anonimo.id}`));
        expect(ajeno.body.esMio).toBe(false);
    });

    test('filtrar por autor, perfil publico y busqueda no delatan al autor', async () => {
        const porAutor = await lector.auth(request(app).get(`/api/posts?autor=${autor.username}`));
        expect(porAutor.body.posts.find((p) => p.id === anonimo.id)).toBeUndefined();

        const porId = await lector.auth(request(app).get(`/api/posts?autor=${autor.id}`));
        expect(porId.body.posts.find((p) => p.id === anonimo.id)).toBeUndefined();

        const perfil = await lector.auth(request(app).get(`/api/users/${autor.id}`));
        expect(perfil.body.posts.find((p) => p.id === anonimo.id)).toBeUndefined();
        expect(perfil.body.estadisticas.posts).toBe(0);

        const texto = await lector.auth(request(app).get('/api/posts?q=zzqx'));
        sinAutor(texto.body.posts.find((p) => p.id === anonimo.id));
    });

    test('quien me sigue no ve mis anonimos en "solo de quienes sigo"', async () => {
        await lector.auth(request(app).post(`/api/users/${autor.id}/seguir`)).expect(200);
        const res = await lector.auth(request(app).get('/api/posts?siguiendo=true&limit=20'));
        expect(res.body.posts.find((p) => p.id === anonimo.id)).toBeUndefined();
    });

    test('el autor ve su anonimo en su propio perfil, sin datos de autor en el JSON', async () => {
        const me = await autor.auth(request(app).get('/api/users/me'));
        const propio = me.body.posts.find((p) => p.id === anonimo.id);
        expect(propio).toBeDefined();
        expect(propio.esAnonimo).toBe(true);
        sinAutor(propio);
    });

    test('solo el admin recibe autorReal', async () => {
        const res = await admin.auth(request(app).get(`/api/posts/${anonimo.id}`));
        expect(res.body.autorReal).toMatchObject({ id: autor.id, username: autor.username });
    });

    test('si el autor comenta su propio post anonimo, su comentario tambien se oculta', async () => {
        await autor.auth(request(app).post(`/api/posts/${anonimo.id}/comentarios`)).send({ contenido: 'yo lo escribi' }).expect(201);
        await lector.auth(request(app).post(`/api/posts/${anonimo.id}/comentarios`)).send({ contenido: 'comentario ajeno' }).expect(201);
        const res = await lector.auth(request(app).get(`/api/posts/${anonimo.id}/comentarios`));
        expect(JSON.stringify(res.body)).not.toContain(autor.username);
        const ajeno = res.body.comentarios.find((c) => c.contenido === 'comentario ajeno');
        expect(ajeno.usernameUsuario).toBe(lector.username);
    });
});

describe('feed: paginacion y filtros', () => {
    let a, b;
    const marca = `feed${Date.now().toString(36)}`;
    beforeAll(async () => {
        a = await crearUsuario('feeda');
        b = await crearUsuario('feedb');
        for (let i = 0; i < 25; i++) {
            await crearPost(a, { titulo: `Post ${marca} ${i}`, contenido: `contenido numero ${i}`, categoriaId: 2, tags: ['paginado'] });
        }
        await crearPost(b, { titulo: `Otro ${marca}`, contenido: 'hablando de calculo integral', categoriaId: 3, tags: ['calculo'] });
    });

    test('limit por defecto 10, tope 20 y orden descendente', async () => {
        const def = await request(app).get('/api/posts');
        expect(def.body.posts).toHaveLength(10);
        const grande = await request(app).get('/api/posts?limit=500');
        expect(grande.body.posts).toHaveLength(20);
        expect(grande.body.paginacion.limit).toBe(20);
        const ids = grande.body.posts.map((p) => p.id);
        expect(ids).toEqual([...ids].sort((x, y) => y - x));
    });

    test('paginas distintas no repiten posts y devuelven totales', async () => {
        const p1 = await request(app).get(`/api/posts?autor=${a.username}&limit=10&page=1`);
        const p3 = await request(app).get(`/api/posts?autor=${a.username}&limit=10&page=3`);
        expect(p1.body.paginacion).toMatchObject({ total: 25, paginas: 3 });
        expect(p3.body.posts).toHaveLength(5);
        expect(p1.body.posts.map((p) => p.id)).not.toEqual(expect.arrayContaining(p3.body.posts.map((p) => p.id)));
    });

    test('filtra por categoria, etiqueta, texto (FULLTEXT y LIKE) y fechas', async () => {
        const cat = await request(app).get('/api/posts?categoria=3&limit=20');
        cat.body.posts.forEach((p) => expect(p.categoriaId).toBe(3));

        const tag = await request(app).get('/api/posts?tag=%23Calculo');
        expect(tag.body.posts).toHaveLength(1);

        const ft = await request(app).get('/api/posts?q=integral');
        expect(ft.body.posts.map((p) => p.titulo)).toEqual([`Otro ${marca}`]);

        const corto = await request(app).get('/api/posts?q=ca&categoria=3');
        expect(corto.status).toBe(200);

        const hoy = new Date().toISOString().slice(0, 10);
        const fecha = await request(app).get(`/api/posts?desde=${hoy}&hasta=${hoy}&tag=calculo`);
        expect(fecha.body.posts).toHaveLength(1);
        const futuro = await request(app).get('/api/posts?desde=2999-01-01&tag=calculo');
        expect(futuro.body.posts).toHaveLength(0);
    });

    test('parametros invalidos dan 400 y la inyeccion SQL no funciona', async () => {
        await request(app).get('/api/posts?desde=ayer').expect(400);
        await request(app).get('/api/posts?categoria=1%20OR%201=1').expect(400);
        const inj = await request(app).get("/api/posts?q=%27%20OR%201%3D1%20--&tag=%27");
        expect(inj.status).toBe(200);
        await request(app).get('/api/posts?q=' + 'x'.repeat(101)).expect(400);
    });

    test('siguiendo=true exige sesion y filtra por seguidos', async () => {
        await request(app).get('/api/posts?siguiendo=true').expect(401);
        const nuevo = await crearUsuario('nuevo');
        await nuevo.auth(request(app).post(`/api/users/${b.id}/seguir`)).expect(200);
        const res = await nuevo.auth(request(app).get('/api/posts?siguiendo=true&limit=20'));
        expect(res.body.posts.length).toBeGreaterThan(0);
        res.body.posts.forEach((p) => expect(p.usuarioId).toBe(b.id));
    });

    test('ranking semanal ordena por likes y luego comentarios', async () => {
        const autor = await crearUsuario('rank');
        const fans = await Promise.all([crearUsuario('f1'), crearUsuario('f2'), crearUsuario('f3')]);
        const popular = await crearPost(autor, { titulo: `Popular ${marca}` });
        const medio = await crearPost(autor, { titulo: `Medio ${marca}` });
        for (const f of fans) await f.auth(request(app).post(`/api/posts/${popular.id}/like`));
        await fans[0].auth(request(app).post(`/api/posts/${medio.id}/like`));

        const res = await request(app).get('/api/posts/ranking-semanal?limit=20');
        expect(res.status).toBe(200);
        const ids = res.body.posts.map((p) => p.id);
        expect(ids.indexOf(popular.id)).toBeLessThan(ids.indexOf(medio.id));
        expect(res.body.posts[0].likes).toBeGreaterThanOrEqual(3);

        // un post de hace mas de 7 dias no entra
        await pool.query('UPDATE posts SET fecha_creacion = DATE_SUB(NOW(), INTERVAL 8 DAY) WHERE id = ?', [popular.id]);
        const despues = await request(app).get('/api/posts/ranking-semanal?limit=20');
        expect(despues.body.posts.map((p) => p.id)).not.toContain(popular.id);
    });
});
