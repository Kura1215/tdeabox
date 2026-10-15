const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { subir } = require('../middleware/upload');
const { toggleLike, agregarLikes } = require('../utils/likes');
const { ErrorHttp, asyncHandler } = require('../utils/errores');
const v = require('../utils/validar');
const { crearNotificacion, notificarMenciones } = require('../services/notificaciones');
const { eliminarComentario } = require('../services/contenido');
const { auditar } = require('../services/auditoria');
const { autorVisible } = require('../services/posts');

const router = express.Router();

const SELECT_COMENTARIO = `
    SELECT co.id, co.contenido, co.imagen_url, co.editado, co.fecha_creacion, co.post_id, co.comentario_padre_id,
           u.id AS usuario_id, u.nombre AS nombre_usuario, u.username AS username_usuario, u.foto_perfil AS foto_usuario
    FROM comentarios co
    JOIN usuarios u ON u.id = co.usuario_id
`;

// Si el autor de un post anonimo comenta en su propio post, su comentario tambien se oculta
// (si no, el username lo delataria).
function serializarComentario(row, post, usuarioActual) {
    const oculto = Boolean(post.es_anonimo) && row.usuario_id === post.usuario_id;
    return {
        id: row.id,
        contenido: row.contenido,
        imagenUrl: row.imagen_url || '',
        editado: Boolean(row.editado),
        fechaCreacion: row.fecha_creacion,
        postId: row.post_id,
        comentarioPadreId: row.comentario_padre_id,
        esMio: Boolean(usuarioActual) && usuarioActual.id === row.usuario_id,
        ...autorVisible(oculto, {
            id: row.usuario_id, nombre: row.nombre_usuario, username: row.username_usuario, foto: row.foto_usuario
        }, usuarioActual),
        likes: 0,
        likedByMe: false
    };
}

async function obtenerPostBasico(id) {
    const [posts] = await pool.query('SELECT id, usuario_id, es_anonimo FROM posts WHERE id = ?', [id]);
    if (posts.length === 0) throw new ErrorHttp(404, 'Post no encontrado');
    return posts[0];
}

// Comentarios raiz paginados, cada uno con sus respuestas (un solo nivel)
router.get('/posts/:id/comentarios', requireAuth.opcional, asyncHandler(async (req, res) => {
    const postId = v.entero(req.params.id, 'El id');
    const post = await obtenerPostBasico(postId);
    const { page, limit, offset } = v.paginacion(req.query, { porDefecto: 20, maxLimit: 50 });

    const [[{ total }]] = await pool.query(
        'SELECT COUNT(*) AS total FROM comentarios WHERE post_id = ? AND comentario_padre_id IS NULL', [postId]);
    const [raices] = await pool.query(
        `${SELECT_COMENTARIO} WHERE co.post_id = ? AND co.comentario_padre_id IS NULL
         ORDER BY co.fecha_creacion ASC, co.id ASC LIMIT ? OFFSET ?`, [postId, limit, offset]);

    let respuestas = [];
    if (raices.length > 0) {
        [respuestas] = await pool.query(
            `${SELECT_COMENTARIO} WHERE co.comentario_padre_id IN (?) ORDER BY co.fecha_creacion ASC, co.id ASC`,
            [raices.map((r) => r.id)]);
    }

    const comentarios = raices.map((r) => ({ ...serializarComentario(r, post, req.usuario), respuestas: [] }));
    const porId = new Map(comentarios.map((c) => [c.id, c]));
    respuestas.forEach((r) => porId.get(r.comentario_padre_id).respuestas.push(serializarComentario(r, post, req.usuario)));

    const todos = comentarios.flatMap((c) => [c, ...c.respuestas]);
    await agregarLikes('comentario_likes', 'comentario_id', todos, req.usuario && req.usuario.id);

    res.json({
        exito: true,
        comentarios,
        paginacion: { page, limit, total, paginas: Math.ceil(total / limit) }
    });
}));

// Crea un comentario; si hay padre, es una respuesta (maximo un nivel)
async function crearComentario(req, res, postId, padre) {
    const contenido = v.texto(req.body.contenido, 'El comentario', { max: 500 });
    const post = await obtenerPostBasico(postId);

    if (padre) {
        if (padre.comentario_padre_id !== null) throw new ErrorHttp(400, 'No se puede responder a una respuesta');
        if (padre.post_id !== postId) throw new ErrorHttp(400, 'El comentario padre es de otro post');
    }

    const imagenUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const [resultado] = await pool.query(
        'INSERT INTO comentarios (contenido, imagen_url, usuario_id, post_id, comentario_padre_id) VALUES (?, ?, ?, ?, ?)',
        [contenido, imagenUrl, req.usuario.id, postId, padre ? padre.id : null]);
    const id = resultado.insertId;

    const [[actor]] = await pool.query('SELECT id, username FROM usuarios WHERE id = ?', [req.usuario.id]);
    const ocultarAutor = Boolean(post.es_anonimo) && req.usuario.id === post.usuario_id;

    await crearNotificacion({
        destinoId: post.usuario_id,
        actorId: req.usuario.id,
        tipo: 'comentario',
        mensaje: `@${actor.username} comentó tu publicación`,
        referenciaId: postId,
        clave: `comentario:${id}:post`
    });
    if (padre && padre.usuario_id !== post.usuario_id) {
        await crearNotificacion({
            destinoId: padre.usuario_id,
            actorId: req.usuario.id,
            tipo: 'comentario',
            mensaje: `@${actor.username} respondió tu comentario`,
            referenciaId: postId,
            clave: `comentario:${id}:respuesta`
        });
    }
    await notificarMenciones({
        texto: contenido,
        actor: ocultarAutor ? null : actor,
        postId,
        claveBase: `mencion:comentario:${id}`
    });

    const [rows] = await pool.query(`${SELECT_COMENTARIO} WHERE co.id = ?`, [id]);
    const comentario = serializarComentario(rows[0], post, req.usuario);
    if (!padre) comentario.respuestas = [];
    res.status(201).json(comentario);
}

router.post('/posts/:id/comentarios', requireAuth, subir('imagen', 'comentario'), asyncHandler(async (req, res) => {
    const postId = v.entero(req.params.id, 'El id');
    let padre = null;
    if (req.body.comentarioPadreId) {
        const [rows] = await pool.query('SELECT id, post_id, usuario_id, comentario_padre_id FROM comentarios WHERE id = ?',
            [v.entero(req.body.comentarioPadreId, 'El comentario padre')]);
        if (rows.length === 0) throw new ErrorHttp(404, 'Comentario no encontrado');
        padre = rows[0];
    }
    await crearComentario(req, res, postId, padre);
}));

router.post('/comentarios/:id/respuestas', requireAuth, subir('imagen', 'comentario'), asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT id, post_id, usuario_id, comentario_padre_id FROM comentarios WHERE id = ?',
        [v.entero(req.params.id, 'El id')]);
    if (rows.length === 0) throw new ErrorHttp(404, 'Comentario no encontrado');
    await crearComentario(req, res, rows[0].post_id, rows[0]);
}));

router.put('/comentarios/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    const [rows] = await pool.query('SELECT usuario_id FROM comentarios WHERE id = ?', [id]);
    if (rows.length === 0) throw new ErrorHttp(404, 'Comentario no encontrado');
    if (rows[0].usuario_id !== req.usuario.id) throw new ErrorHttp(403, 'No tienes permiso para editar este comentario');

    const contenido = v.texto(req.body.contenido, 'El comentario', { max: 500 });
    await pool.query('UPDATE comentarios SET contenido = ?, editado = 1 WHERE id = ?', [contenido, id]);

    const [actualizado] = await pool.query(`${SELECT_COMENTARIO} WHERE co.id = ?`, [id]);
    const post = await obtenerPostBasico(actualizado[0].post_id);
    res.json(serializarComentario(actualizado[0], post, req.usuario));
}));

router.post('/comentarios/:id/like', requireAuth, asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    const [comentarios] = await pool.query('SELECT usuario_id, post_id FROM comentarios WHERE id = ?', [id]);
    if (comentarios.length === 0) throw new ErrorHttp(404, 'Comentario no encontrado');

    const { creado, likes, likedByMe } = await toggleLike('comentario_likes', 'comentario_id', id, req.usuario.id);
    if (creado) {
        const [[actor]] = await pool.query('SELECT username FROM usuarios WHERE id = ?', [req.usuario.id]);
        await crearNotificacion({
            destinoId: comentarios[0].usuario_id,
            actorId: req.usuario.id,
            tipo: 'like',
            mensaje: `@${actor.username} le dio like a tu comentario`,
            referenciaId: comentarios[0].post_id,
            clave: `like:comentario:${id}:u${req.usuario.id}`
        });
    }
    res.json({ likes, likedByMe });
}));

router.delete('/comentarios/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    const [rows] = await pool.query('SELECT usuario_id FROM comentarios WHERE id = ?', [id]);
    if (rows.length === 0) throw new ErrorHttp(404, 'Comentario no encontrado');

    const esAutor = rows[0].usuario_id === req.usuario.id;
    if (!esAutor && req.usuario.rol !== 'admin') {
        throw new ErrorHttp(403, 'No tienes permiso para eliminar este comentario');
    }

    await eliminarComentario(id);
    if (!esAutor) await auditar(req.usuario.id, 'eliminar_comentario', 'comentario', id, 'Eliminado por un administrador');
    res.json({ exito: true, mensaje: 'Comentario eliminado correctamente' });
}));

module.exports = router;
