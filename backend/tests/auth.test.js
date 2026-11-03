const { app, request, crearUsuario, PNG_1X1 } = require('./helpers');
const { crearApp } = require('../app');

const base = (extra = {}) => ({
    nombre: 'Ana Perez', username: `ana_${Date.now().toString(36)}`, correo: `ana${Date.now()}@tdea.edu.co`,
    password: 'clave1234', ...extra
});

describe('RF01 registro y login', () => {
    test('registra, devuelve token y la misma forma que login', async () => {
        const datos = base();
        const reg = await request(app).post('/api/auth/register').send(datos);
        expect(reg.status).toBe(201);
        expect(reg.body).toMatchObject({ exito: true, username: datos.username, rol: 'usuario' });
        expect(reg.body.token).toBeTruthy();

        const login = await request(app).post('/api/auth/login').send({ correo: datos.correo, password: datos.password });
        expect(login.status).toBe(200);
        expect(Object.keys(login.body).sort()).toEqual(expect.arrayContaining(['token', 'usuarioId', 'nombre', 'username', 'fotoPerfil', 'rol']));
    });

    test('normaliza el correo a minusculas y permite login con mayusculas', async () => {
        const datos = base();
        await request(app).post('/api/auth/register').send({ ...datos, correo: `  ${datos.correo.toUpperCase()} ` }).expect(201);
        await request(app).post('/api/auth/login').send({ correo: datos.correo.toUpperCase(), password: datos.password }).expect(200);
    });

    test('rechaza dominios que no sean @tdea.edu.co', async () => {
        for (const correo of ['a@gmail.com', 'a@tdea.edu.co.evil.com', 'a@@tdea.edu.co', 'x@tdea.edu.com']) {
            const res = await request(app).post('/api/auth/register').send(base({ correo }));
            expect(res.status).toBe(400);
        }
    });

    test('valida longitudes y formato', async () => {
        const casos = [
            { nombre: 'x'.repeat(101) },
            { username: 'x'.repeat(31) },
            { username: 'con espacios' },
            { username: 'ab' },
            { password: '1234567' },
            { password: 'x'.repeat(21) },
            { nombre: '   ' },
            { correo: `${'a'.repeat(95)}@tdea.edu.co` }
        ];
        for (const caso of casos) {
            const res = await request(app).post('/api/auth/register').send(base(caso));
            expect(res.status).toBe(400);
            expect(res.body.exito).toBe(false);
        }
    });

    test('correo y username duplicados dan 409', async () => {
        const datos = base();
        await request(app).post('/api/auth/register').send(datos).expect(201);
        const dupCorreo = await request(app).post('/api/auth/register').send({ ...datos, username: 'otro_' + Date.now().toString(36) });
        expect(dupCorreo.status).toBe(409);
        const dupUser = await request(app).post('/api/auth/register').send({ ...datos, correo: `otro${Date.now()}@tdea.edu.co` });
        expect(dupUser.status).toBe(409);
    });

    test('registros concurrentes con el mismo correo: solo uno gana', async () => {
        const datos = base();
        const respuestas = await Promise.all(
            Array.from({ length: 5 }, () => request(app).post('/api/auth/register').send(datos)));
        const estados = respuestas.map((r) => r.status);
        expect(estados.filter((s) => s === 201)).toHaveLength(1);
        expect(estados.filter((s) => s === 409)).toHaveLength(4);
    });

    test('login con credenciales malas da el mismo mensaje exista o no el correo', async () => {
        const u = await crearUsuario();
        const malaClave = await request(app).post('/api/auth/login').send({ correo: u.correo, password: 'incorrecta1' });
        const noExiste = await request(app).post('/api/auth/login').send({ correo: 'noexiste@tdea.edu.co', password: 'incorrecta1' });
        expect(malaClave.status).toBe(401);
        expect(noExiste.status).toBe(401);
        expect(malaClave.body.error).toBe(noExiste.body.error);
    });

    test('la contraseña no se guarda en texto plano', async () => {
        const { pool } = require('./helpers');
        const u = await crearUsuario();
        const [[fila]] = await pool.query('SELECT password_hash FROM usuarios WHERE id = ?', [u.id]);
        expect(fila.password_hash).not.toContain('clave1234');
        expect(fila.password_hash).toMatch(/^\$2[aby]\$10\$/);
    });

    test('el token de acceso dura 15 minutos y la sesion (cookie HttpOnly) 7 dias', async () => {
        const datos = base();
        const res = await request(app).post('/api/auth/register').send(datos).expect(201);
        const payload = JSON.parse(Buffer.from(res.body.token.split('.')[1], 'base64').toString());
        expect(payload.exp - payload.iat).toBe(15 * 60);

        const cookie = res.headers['set-cookie'][0];
        expect(cookie).toMatch(/^tdeavox_sesion=/);
        expect(cookie).toMatch(/HttpOnly/);
        expect(cookie).toMatch(/SameSite=Strict/);
        expect(cookie).toMatch(/Path=\/api\/auth/);
        const dias = (new Date(cookie.match(/Expires=([^;]+)/)[1]) - Date.now()) / (24 * 3600 * 1000);
        expect(Math.round(dias)).toBe(7);
    });

    test('renovar entrega un token nuevo con la cookie y exige el header anti-CSRF', async () => {
        const datos = base();
        const reg = await request(app).post('/api/auth/register').send(datos).expect(201);
        const cookie = reg.headers['set-cookie'][0].split(';')[0];

        // sin el header propio (como haria un formulario de otro sitio) se rechaza
        await request(app).post('/api/auth/renovar').set('Cookie', cookie).expect(403);
        // sin cookie no hay sesion
        await request(app).post('/api/auth/renovar').set('X-Requested-With', 'TdeaVox').expect(401);

        const ren = await request(app).post('/api/auth/renovar').set('Cookie', cookie).set('X-Requested-With', 'TdeaVox');
        expect(ren.status).toBe(200);
        expect(ren.body).toMatchObject({ exito: true, usuarioId: reg.body.usuarioId, username: datos.username });
        await request(app).get('/api/users/me').set('Authorization', `Bearer ${ren.body.token}`).expect(200);
    });

    test('cerrar sesion revoca la cookie y los tokens de esa sesion', async () => {
        const datos = base();
        const reg = await request(app).post('/api/auth/register').send(datos).expect(201);
        const cookie = reg.headers['set-cookie'][0].split(';')[0];
        const auth = `Bearer ${reg.body.token}`;
        await request(app).get('/api/users/me').set('Authorization', auth).expect(200);

        const salir = await request(app).post('/api/auth/logout').set('Cookie', cookie).set('X-Requested-With', 'TdeaVox');
        expect(salir.status).toBe(200);
        expect(salir.headers['set-cookie'][0]).toMatch(/tdeavox_sesion=;/);

        // el JWT aun no vence, pero su sesion ya no existe
        await request(app).get('/api/users/me').set('Authorization', auth).expect(401);
        await request(app).post('/api/auth/renovar').set('Cookie', cookie).set('X-Requested-With', 'TdeaVox').expect(401);

        // otra sesion del mismo usuario (otro navegador) sigue abierta
        const otra = await request(app).post('/api/auth/login').send({ correo: datos.correo, password: datos.password });
        await request(app).get('/api/users/me').set('Authorization', `Bearer ${otra.body.token}`).expect(200);
    });

    test('un token vencido da 401 tambien en rutas publicas (para que el frontend lo renueve)', async () => {
        const jwt = require('jsonwebtoken');
        const u = await crearUsuario();
        const { sid } = jwt.decode(u.token);
        const vencido = jwt.sign({ sub: String(u.id), sid, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
        await request(app).get('/api/posts').set('Authorization', `Bearer ${vencido}`).expect(401);
        // sin token sigue funcionando como visitante
        await request(app).get('/api/posts').expect(200);
    });

    test('rate limiting en auth: bloquea tras superar el maximo', async () => {
        const limitada = crearApp({ authRateMax: 3 });
        const estados = [];
        for (let i = 0; i < 5; i++) {
            const r = await request(limitada).post('/api/auth/login').send({ correo: 'x@tdea.edu.co', password: 'mala12345' });
            estados.push(r.status);
        }
        expect(estados.slice(0, 3)).toEqual([401, 401, 401]);
        expect(estados.slice(3)).toEqual([429, 429]);
    });

    test('registro con foto valida y con archivo de MIME falso', async () => {
        const ok = await request(app).post('/api/auth/register')
            .field('nombre', 'Con Foto').field('username', `foto_${Date.now().toString(36)}`)
            .field('correo', `foto${Date.now()}@tdea.edu.co`).field('password', 'clave1234')
            .attach('foto', PNG_1X1, { filename: 'a.png', contentType: 'image/png' });
        expect(ok.status).toBe(201);
        expect(ok.body.fotoPerfil).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);

        // texto disfrazado de imagen: engaña a la extension y al mimetype, no a la firma
        const falso = await request(app).post('/api/auth/register')
            .field('nombre', 'Falso').field('username', `falso_${Date.now().toString(36)}`)
            .field('correo', `falso${Date.now()}@tdea.edu.co`).field('password', 'clave1234')
            .attach('foto', Buffer.from('<?php echo 1; ?>'), { filename: 'a.png', contentType: 'image/png' });
        expect(falso.status).toBe(400);
    });

    test('rutas protegidas exigen token valido', async () => {
        await request(app).get('/api/users/me').expect(401);
        await request(app).get('/api/users/me').set('Authorization', 'Bearer basura').expect(401);
    });

    test('ruta inexistente y JSON mal formado devuelven el formato estandar', async () => {
        const r404 = await request(app).get('/api/nada');
        expect(r404.status).toBe(404);
        expect(r404.body.exito).toBe(false);
        const mal = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{malo');
        expect(mal.status).toBe(400);
    });
});
