const request = require('supertest');
const mysql = require('mysql2/promise');
const { crearApp } = require('../app');

// Conexion directa a MySQL solo para que los tests revisen la BD (triggers, cascadas, duplicados).
// La aplicacion no la usa: trabaja con los modelos de Sequelize.
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

const app = crearApp();
let contador = 0;

// PNG valido de 1x1 pixel
const PNG_1X1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64');

// Usuario nuevo con correo/username unicos; devuelve { id, token, username, correo, auth() }
async function crearUsuario(prefijo = 'u') {
    contador += 1;
    const sufijo = `${Date.now().toString(36)}${contador}`;
    const username = `${prefijo}_${sufijo}`.slice(0, 30);
    const correo = `${username}@tdea.edu.co`;
    const res = await request(app).post('/api/auth/register')
        .send({ nombre: `Usuario ${prefijo}`, username, correo, password: 'clave1234' });
    if (res.status !== 201) throw new Error(`No se pudo crear usuario: ${JSON.stringify(res.body)}`);
    const token = res.body.token;
    return {
        id: res.body.usuarioId, token, username, correo,
        auth: (req) => req.set('Authorization', `Bearer ${token}`)
    };
}

async function loginAdmin() {
    const res = await request(app).post('/api/auth/login')
        .send({ correo: 'admin.test@tdea.edu.co', password: 'admin-test-1234' });
    const token = res.body.token;
    return { id: res.body.usuarioId, token, auth: (req) => req.set('Authorization', `Bearer ${token}`) };
}

async function crearPost(usuario, extra = {}) {
    const res = await usuario.auth(request(app).post('/api/posts')).send({
        titulo: 'Titulo de prueba', contenido: 'Contenido de prueba', categoriaId: 4, ...extra
    });
    if (res.status !== 201) throw new Error(`No se pudo crear post: ${JSON.stringify(res.body)}`);
    return res.body;
}

async function crearComentario(usuario, postId, extra = {}) {
    const res = await usuario.auth(request(app).post(`/api/posts/${postId}/comentarios`))
        .send({ contenido: 'Un comentario', ...extra });
    if (res.status !== 201) throw new Error(`No se pudo crear comentario: ${JSON.stringify(res.body)}`);
    return res.body;
}

module.exports = { app, pool, request, PNG_1X1, crearUsuario, loginAdmin, crearPost, crearComentario };
