const pool = require('../db');
const { agregarLikes } = require('../utils/likes');
const { ignorarDuplicado, ErrorHttp } = require('../utils/errores');

const SELECT_POST = `
    SELECT p.id, p.titulo, p.contenido, p.imagen_url, p.es_anonimo, p.editado, p.editado_at, p.fecha_creacion,
           u.id AS usuario_id, u.nombre AS nombre_usuario, u.username AS username_usuario, u.foto_perfil AS foto_usuario,
           c.id AS categoria_id, c.nombre AS nombre_categoria
    FROM posts p
    JOIN usuarios u ON u.id = p.usuario_id
    JOIN categorias c ON c.id = p.categoria_id
`;

// Datos del autor tal como los ve quien consulta. Un post anonimo NUNCA expone al autor real
// en la API; solo el admin recibe ademas `autorReal`.
function autorVisible(anonimo, autor, usuarioActual) {
    if (!anonimo) {
        return {
            usuarioId: autor.id,
            nombreUsuario: autor.nombre,
            usernameUsuario: autor.username,
            fotoPerfilUsuario: autor.foto || ''
        };
    }
    const visible = { usuarioId: null, nombreUsuario: 'Anónimo', usernameUsuario: '', fotoPerfilUsuario: '' };
    if (usuarioActual && usuarioActual.rol === 'admin') {
        visible.autorReal = { id: autor.id, nombre: autor.nombre, username: autor.username };
    }
    return visible;
}

// Convierte filas de SELECT_POST en objetos de la API, agregando likes, etiquetas, comentarios y guardado
// con consultas agrupadas (no una por post).
async function serializarPosts(rows, usuarioActual) {
    const posts = rows.map((r) => ({
        id: r.id,
        titulo: r.titulo,
        contenido: r.contenido,
        imagenUrl: r.imagen_url || '',
        fechaCreacion: r.fecha_creacion,
        esAnonimo: Boolean(r.es_anonimo),
        editado: Boolean(r.editado),
        editadoAt: r.editado_at,
        categoriaId: r.categoria_id,
        nombreCategoria: r.nombre_categoria,
        esMio: Boolean(usuarioActual) && usuarioActual.id === r.usuario_id,
        ...autorVisible(r.es_anonimo, {
            id: r.usuario_id, nombre: r.nombre_usuario, username: r.username_usuario, foto: r.foto_usuario
        }, usuarioActual),
        tags: [],
        totalComentarios: 0,
        guardado: false
    }));
    if (posts.length === 0) return posts;

    await agregarLikes('post_likes', 'post_id', posts, usuarioActual && usuarioActual.id);

    const ids = posts.map((p) => p.id);
    const porId = new Map(posts.map((p) => [p.id, p]));

    const [tags] = await pool.query(
        `SELECT pt.post_id, t.nombre FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
         WHERE pt.post_id IN (?) ORDER BY t.nombre`, [ids]);
    tags.forEach((t) => porId.get(t.post_id).tags.push(t.nombre));

    const [comentarios] = await pool.query(
        'SELECT post_id, COUNT(*) AS total FROM comentarios WHERE post_id IN (?) GROUP BY post_id', [ids]);
    comentarios.forEach((c) => { porId.get(c.post_id).totalComentarios = Number(c.total); });

    if (usuarioActual) {
        const [guardados] = await pool.query(
            'SELECT post_id FROM guardados WHERE usuario_id = ? AND post_id IN (?)', [usuarioActual.id, ids]);
        guardados.forEach((g) => { porId.get(g.post_id).guardado = true; });
    }
    return posts;
}

async function obtenerPost(id, usuarioActual) {
    const [rows] = await pool.query(`${SELECT_POST} WHERE p.id = ?`, [id]);
    if (rows.length === 0) throw new ErrorHttp(404, 'Post no encontrado');
    return (await serializarPosts(rows, usuarioActual))[0];
}

// Busca o crea las etiquetas (ya normalizadas) y devuelve sus ids.
// UNIQUE(nombre) decide si dos peticiones crean la misma etiqueta a la vez: la perdedora la relee.
async function resolverTags(nombres) {
    const ids = [];
    for (const nombre of nombres) {
        let [rows] = await pool.query('SELECT id FROM tags WHERE nombre = ?', [nombre]);
        if (rows.length === 0) {
            await ignorarDuplicado(() => pool.query('INSERT INTO tags (nombre) VALUES (?)', [nombre]));
            [rows] = await pool.query('SELECT id FROM tags WHERE nombre = ?', [nombre]);
        }
        if (!ids.includes(rows[0].id)) ids.push(rows[0].id);
    }
    return ids;
}

// Ejecuta fn(conexion) dentro de una transaccion. MySQL puede abortar una de dos transacciones
// concurrentes por deadlock (p. ej. dos posts nuevos con la misma etiqueta); en ese caso se reintenta.
async function conTransaccion(fn, intentos = 4) {
    for (let intento = 1; ; intento++) {
        const conexion = await pool.getConnection();
        try {
            await conexion.beginTransaction();
            const resultado = await fn(conexion);
            await conexion.commit();
            return resultado;
        } catch (error) {
            await conexion.rollback().catch(() => {});
            if (error.code === 'ER_LOCK_DEADLOCK' && intento < intentos) continue;
            throw error;
        } finally {
            conexion.release();
        }
    }
}

module.exports = { SELECT_POST, serializarPosts, obtenerPost, resolverTags, conTransaccion, autorVisible };
