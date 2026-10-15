const { app, pool, request, crearUsuario, loginAdmin, crearPost, crearComentario } = require('./helpers');

describe('RF08 reportes y panel admin', () => {
    let autor, reportante, admin, post, comentario;
    beforeAll(async () => {
        autor = await crearUsuario('mautor');
        reportante = await crearUsuario('mrep');
        admin = await loginAdmin();
        post = await crearPost(autor, { esAnonimo: true, titulo: 'Post a moderar' });
        comentario = await crearComentario(autor, post.id, { contenido: 'comentario a moderar' });
    });

    const reportar = (usuario, cuerpo) => usuario.auth(request(app).post('/api/reportes')).send(cuerpo);

    test('reporta post y comentario con motivos validos', async () => {
        await reportar(reportante, { tipo: 'post', id: post.id, motivo: 'spam' }).expect(201);
        await reportar(reportante, { tipo: 'comentario', id: comentario.id, motivo: 'contenido_inapropiado' }).expect(201);
    });

    test('descripcion obligatoria solo si el motivo es "otro", maximo 300', async () => {
        const otro = await crearUsuario('mrep2');
        await reportar(otro, { tipo: 'post', id: post.id, motivo: 'otro' }).expect(400);
        await reportar(otro, { tipo: 'post', id: post.id, motivo: 'otro', descripcion: 'x'.repeat(301) }).expect(400);
        await reportar(otro, { tipo: 'post', id: post.id, motivo: 'otro', descripcion: 'Razon' }).expect(201);
    });

    test('valida tipo, motivo, existencia y sesion', async () => {
        await reportar(reportante, { tipo: 'usuario', id: 1, motivo: 'spam' }).expect(400);
        await reportar(reportante, { tipo: 'post', id: post.id, motivo: 'molesto' }).expect(400);
        await reportar(reportante, { tipo: 'post', id: 99999999, motivo: 'spam' }).expect(404);
        await reportar(reportante, { tipo: 'post', id: 'abc', motivo: 'spam' }).expect(400);
        await request(app).post('/api/reportes').send({ tipo: 'post', id: post.id, motivo: 'spam' }).expect(401);
    });

    test('reportar dos veces lo mismo da 409, tambien en paralelo', async () => {
        const dup = await reportar(reportante, { tipo: 'post', id: post.id, motivo: 'spam' });
        expect(dup.status).toBe(409);

        const nuevo = await crearUsuario('mrep3');
        const rs = await Promise.all(Array.from({ length: 5 }, () => reportar(nuevo, { tipo: 'post', id: post.id, motivo: 'spam' })));
        expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
        expect(rs.filter((r) => r.status === 409)).toHaveLength(4);
    });

    test('la BD exige exactamente un objetivo por reporte', async () => {
        await expect(pool.query("INSERT INTO reportes (reportante_id, tipo_objetivo, motivo) VALUES (?, 'post', 'spam')", [reportante.id]))
            .rejects.toThrow(/exactamente un objetivo/);
        await expect(pool.query("INSERT INTO reportes (reportante_id, post_id, comentario_id, tipo_objetivo, motivo) VALUES (?, ?, ?, 'post', 'spam')",
            [reportante.id, post.id, comentario.id])).rejects.toThrow(/exactamente un objetivo/);
    });

    test('solo administradores acceden a /api/admin', async () => {
        for (const ruta of ['/api/admin/reportes', '/api/admin/auditoria']) {
            await request(app).get(ruta).expect(401);
            await reportante.auth(request(app).get(ruta)).expect(403);
        }
        await reportante.auth(request(app).delete(`/api/admin/posts/${post.id}`)).expect(403);
        await reportante.auth(request(app).patch('/api/admin/reportes/1')).send({ estado: 'revisado' }).expect(403);
    });

    test('el admin lista reportes y ve el autor real del post anonimo', async () => {
        const res = await admin.auth(request(app).get('/api/admin/reportes?estado=pendiente&limit=50'));
        expect(res.status).toBe(200);
        const delPost = res.body.reportes.find((r) => r.tipo === 'post' && r.contenido && r.contenido.id === post.id);
        expect(delPost.autorReal).toMatchObject({ id: autor.id, username: autor.username });
        expect(delPost.contenido.esAnonimo).toBe(true);
        await admin.auth(request(app).get('/api/admin/reportes?estado=raro')).expect(400);
    });

    test('descartar un reporte lo marca y lo audita', async () => {
        const rep = await crearUsuario('mrep4');
        const p = await crearPost(autor);
        await reportar(rep, { tipo: 'post', id: p.id, motivo: 'spam' });
        const [[{ id }]] = await pool.query('SELECT id FROM reportes WHERE post_id = ?', [p.id]);

        await admin.auth(request(app).patch(`/api/admin/reportes/${id}`)).send({ estado: 'pendiente' }).expect(400);
        await admin.auth(request(app).patch(`/api/admin/reportes/${id}`)).send({ estado: 'descartado', eliminarContenido: true }).expect(400);
        await admin.auth(request(app).patch('/api/admin/reportes/99999999')).send({ estado: 'descartado' }).expect(404);
        await admin.auth(request(app).patch(`/api/admin/reportes/${id}`)).send({ estado: 'descartado' }).expect(200);

        const [[rep2]] = await pool.query('SELECT estado FROM reportes WHERE id = ?', [id]);
        expect(rep2.estado).toBe('descartado');
        const [aud] = await pool.query("SELECT * FROM auditoria_admin WHERE accion = 'reporte_descartado' AND entidad_id = ?", [id]);
        expect(aud).toHaveLength(1);
        await request(app).get(`/api/posts/${p.id}`).expect(200); // el contenido sigue
    });

    test('revisar + eliminar contenido: borra el post, conserva el reporte y resuelve los demas', async () => {
        const p = await crearPost(autor, { titulo: 'Para borrar' });
        const r1 = await crearUsuario('mrepa');
        const r2 = await crearUsuario('mrepb');
        await reportar(r1, { tipo: 'post', id: p.id, motivo: 'spam' });
        await reportar(r2, { tipo: 'post', id: p.id, motivo: 'spam' });
        const [reportes] = await pool.query('SELECT id FROM reportes WHERE post_id = ? ORDER BY id', [p.id]);

        await admin.auth(request(app).patch(`/api/admin/reportes/${reportes[0].id}`)).send({ estado: 'revisado', eliminarContenido: true }).expect(200);
        await request(app).get(`/api/posts/${p.id}`).expect(404);

        const [despues] = await pool.query('SELECT id, estado, post_id, tipo_objetivo FROM reportes WHERE id IN (?)', [reportes.map((r) => r.id)]);
        expect(despues).toHaveLength(2); // los reportes se conservan
        despues.forEach((r) => {
            expect(r.estado).toBe('revisado');
            expect(r.post_id).toBeNull();
            expect(r.tipo_objetivo).toBe('post');
        });

        const lista = await admin.auth(request(app).get('/api/admin/reportes?limit=50'));
        expect(lista.body.reportes.find((r) => r.id === reportes[1].id).contenidoEliminado).toBe(true);

        const [aud] = await pool.query("SELECT accion FROM auditoria_admin WHERE entidad_id = ? AND entidad = 'post'", [p.id]);
        expect(aud.map((a) => a.accion)).toContain('eliminar_post');
    });

    test('eliminar un comentario desde un reporte', async () => {
        const p = await crearPost(autor);
        const c = await crearComentario(autor, p.id);
        const rep = await crearUsuario('mrepc');
        await reportar(rep, { tipo: 'comentario', id: c.id, motivo: 'contenido_inapropiado' });
        const [[{ id }]] = await pool.query('SELECT id FROM reportes WHERE comentario_id = ?', [c.id]);

        await admin.auth(request(app).patch(`/api/admin/reportes/${id}`)).send({ estado: 'revisado', eliminarContenido: true }).expect(200);
        const [rows] = await pool.query('SELECT id FROM comentarios WHERE id = ?', [c.id]);
        expect(rows).toHaveLength(0);
    });

    test('borrado directo de admin (post y comentario) queda auditado', async () => {
        const p = await crearPost(autor);
        const c = await crearComentario(autor, p.id);
        await admin.auth(request(app).delete(`/api/admin/comentarios/${c.id}`)).expect(200);
        await admin.auth(request(app).delete(`/api/admin/posts/${p.id}`)).expect(200);
        await admin.auth(request(app).delete('/api/admin/posts/99999999')).expect(404);

        const res = await admin.auth(request(app).get('/api/admin/auditoria?limit=50'));
        const acciones = res.body.registros.filter((r) => [p.id, c.id].includes(r.entidadId)).map((r) => r.accion);
        expect(acciones).toEqual(expect.arrayContaining(['eliminar_post', 'eliminar_comentario']));
        expect(res.body.registros[0].admin).toBe('admin_test');
    });

    test('un usuario normal no puede promoverse a admin', async () => {
        await reportante.auth(request(app).put('/api/users/me')).send({ rol: 'admin', nombre: 'Hacker' }).expect(200);
        const me = await reportante.auth(request(app).get('/api/users/me'));
        expect(me.body.rol).toBe('usuario');
    });
});
