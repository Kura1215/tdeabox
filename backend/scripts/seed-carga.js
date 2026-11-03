// Genera un dataset grande en una BD aparte (tdeavox_carga) para medir el rendimiento (RNF02):
// 20.000 usuarios, 60.000 posts, 120.000 comentarios, 200.000 likes y 40.000 seguimientos.
// Uso: node scripts/seed-carga.js
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { inicializar } = require('./initdb');

const BD = 'tdeavox_carga';
const USUARIOS = 20000;
const POSTS = 60000;
const COMENTARIOS = 120000;
const LIKES = 200000;
const SEGUIDORES = 40000;
const LOTE = 2000;

const aleatorio = (n) => 1 + Math.floor(Math.random() * n);
// Vocabulario de 4.000 palabras inventadas con frecuencia tipo Zipf (pocas muy comunes, muchas raras),
// mas dos temas ('calculo', 'parcial') que aparecen en ~2% de los textos cada uno.
const SILABAS = ['ba', 'ce', 'di', 'fo', 'gu', 'la', 'me', 'ni', 'po', 'ru', 'sa', 'te', 'vo', 'xi', 'za'];
const VOCABULARIO = Array.from({ length: 4000 }, (_, i) => {
    let n = i + 1;
    let palabra = '';
    while (n > 0) { palabra += SILABAS[n % SILABAS.length]; n = Math.floor(n / SILABAS.length); }
    return palabra + 'x';
});
const palabra = () => VOCABULARIO[Math.floor(VOCABULARIO.length * Math.random() ** 3)];
const frase = () => {
    const palabras = Array.from({ length: 12 }, palabra);
    if (Math.random() < 0.02) palabras.push('calculo');
    if (Math.random() < 0.02) palabras.push('parcial');
    return palabras.join(' ');
};

async function insertarEnLotes(c, sql, total, fila) {
    for (let i = 0; i < total; i += LOTE) {
        const filas = [];
        for (let j = i; j < Math.min(i + LOTE, total); j++) filas.push(fila(j + 1));
        await c.query(sql, [filas]);
    }
}

(async () => {
    const c0 = await mysql.createConnection({
        host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD
    });
    await c0.query(`DROP DATABASE IF EXISTS ${BD}`);
    await c0.end();

    process.env.ADMIN_CORREO = 'carga.admin@tdea.edu.co';
    process.env.ADMIN_PASSWORD = 'carga-admin-1234';
    process.env.ADMIN_USERNAME = 'carga_admin';
    await inicializar({ nombreBD: BD });

    const c = await mysql.createConnection({
        host: process.env.DB_HOST, port: process.env.DB_PORT, user: process.env.DB_USER,
        password: process.env.DB_PASSWORD, database: BD
    });
    const hash = await bcrypt.hash('clave1234', 10);
    const t0 = Date.now();

    console.log('Usuarios...');
    await insertarEnLotes(c, 'INSERT INTO usuarios (nombre, username, correo, password_hash) VALUES ?', USUARIOS,
        (i) => [`Usuario ${i}`, `usuario_${i}`, `usuario_${i}@tdea.edu.co`, hash]);
    const [[{ max }]] = await c.query('SELECT MAX(id) AS max FROM usuarios');
    const primero = max - USUARIOS + 1;
    const usuario = () => primero + Math.floor(Math.random() * USUARIOS);

    console.log('Posts...');
    await insertarEnLotes(c,
        'INSERT INTO posts (titulo, contenido, es_anonimo, fecha_creacion, usuario_id, categoria_id) VALUES ?', POSTS,
        (i) => [`Publicacion ${i} ${frase().slice(0, 40)}`, frase() + ' ' + frase(), Math.random() < 0.05 ? 1 : 0,
            new Date(Date.now() - Math.random() * 90 * 86400000), usuario(), aleatorio(4)]);
    const [[{ maxPost }]] = await c.query('SELECT MAX(id) AS maxPost FROM posts');
    const primerPost = maxPost - POSTS + 1;
    const post = () => primerPost + Math.floor(Math.random() * POSTS);

    console.log('Comentarios...');
    await insertarEnLotes(c, 'INSERT INTO comentarios (contenido, usuario_id, post_id) VALUES ?', COMENTARIOS,
        () => [frase(), usuario(), post()]);

    console.log('Likes...');
    await insertarEnLotes(c, 'INSERT IGNORE INTO post_likes (post_id, usuario_id) VALUES ?', LIKES, () => [post(), usuario()]);

    console.log('Seguidores...');
    for (let i = 0; i < SEGUIDORES; i += LOTE) {
        const filas = [];
        for (let j = 0; j < LOTE; j++) {
            const a = usuario();
            const b = usuario();
            if (a !== b) filas.push([a, b]);
        }
        await c.query('INSERT IGNORE INTO seguidores (seguidor_id, seguido_id) VALUES ?', [filas]);
    }

    await c.query('ANALYZE TABLE posts, comentarios, post_likes, seguidores, usuarios');
    console.log(`Listo en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    await c.end();
})().catch((e) => { console.error(e); process.exit(1); });
