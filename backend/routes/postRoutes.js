const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { subir, eliminarImagen } = require('../middleware/upload');
const { toggleLike } = require('../utils/likes');
const { ErrorHttp, asyncHandler, ignorarDuplicado, reintentarDeadlock } = require('../utils/errores');
const v = require('../utils/validar');
const { crearNotificacion, notificarMenciones } = require('../services/notificaciones');
const { eliminarPost } = require('../services/contenido');
const { auditar } = require('../services/auditoria');
const { SELECT_POST, serializarPosts, obtenerPost, resolverTags, conTransaccion } = require('../services/posts');

const router = express.Router();

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const TOPE_CONTEO = 5000;
const TTL_RANKING_MS = 60 * 1000;
let cacheRanking = { ids: [], hasta: 0 };
let calculoRanking = null;

function fechaQuery(valor, campo) {
    if (valor === undefined || valor === '') return null;
    if (typeof valor !== 'string' || !REGEX_FECHA.test(valor) || Number.isNaN(Date.parse(valor))) {
        throw new ErrorHttp(400, `${campo} debe tener formato AAAA-MM-DD`);
    }
    return valor;
}

// Arma el texto de busqueda: FULLTEXT cuando todas las palabras tienen 3+ letras (minimo del indice
// InnoDB) y LIKE en caso contrario.
function filtroTexto(q, filtros, params) {
    const palabras = q.split(/\s+/)
        .map((p) => p.replace(/[^\p{L}\p{N}_]/gu, ''))
        .filter(Boolean);
    if (palabras.length === 0) return;

    if (palabras.every((p) => p.length >= 3)) {
        filtros.push('MATCH(p.titulo, p.contenido) AGAINST (? IN BOOLEAN MODE)');
        params.push(palabras.map((p) => `+${p}*`).join(' '));
    } else {
        const patron = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
        filtros.push('(p.titulo LIKE ? OR p.contenido LIKE ?)');
        params.push(patron, patron);
    }
}

router.get('/categorias', asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT id, nombre, descripcion FROM categorias ORDER BY id');
    res.json(rows);
}));

// Feed paginado con filtros combinables
router.get('/posts', requireAuth.opcional, asyncHandler(async (req, res) => {
    const { page, limit, offset } = v.paginacion(req.query);
    const { categoria, tag, autor, q, siguiendo } = req.query;
    const desde = fechaQuery(req.query.desde, 'desde');
    const hasta = fechaQuery(req.query.hasta, 'hasta');

    const filtros = [];
    const params = [];

    if (categoria) {
        filtros.push('p.categoria_id = ?');
        params.push(v.entero(categoria, 'categoria'));
    }
    if (tag) {
        filtros.push(`EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
                              WHERE pt.post_id = p.id AND t.nombre = ?)`);
        params.push(String(tag).trim().replace(/^#/, '').toLowerCase());
    }
    if (autor) {
        // los posts anonimos nunca aparecen al filtrar por autor (revelaria quien los escribio)
        filtros.push('p.es_anonimo = 0 AND (u.username = ? OR u.id = ?)');
        params.push(String(autor).trim(), Number(autor) || 0);
    }
    if (q) {
        filtroTexto(v.texto(q, 'La busqueda', { max: 100 }), filtros, params);
    }
    if (desde) {
        filtros.push('p.fecha_creacion >= ?');
        params.push(desde);
    }
    if (hasta) {
        filtros.push('p.fecha_creacion < DATE_ADD(?, INTERVAL 1 DAY)');
        params.push(hasta);
    }
    if (v.booleano(siguiendo)) {
        if (!req.usuario) throw new ErrorHttp(401, 'Inicia sesión para ver las publicaciones de quienes sigues');
        // sin anonimos: mostrarlos aqui revelaria que la persona seguida los escribio
        filtros.push('p.es_anonimo = 0 AND p.usuario_id IN (SELECT seguido_id FROM seguidores WHERE seguidor_id = ?)');
        params.push(req.usuario.id);
    }

    const where = filtros.length > 0 ? ' WHERE ' + filtros.join(' AND ') : '';

    // el total se acota a TOPE_CONTEO para que contar no recorra millones de filas
    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM (SELECT 1 FROM posts p JOIN usuarios u ON u.id = p.usuario_id${where} LIMIT ${TOPE_CONTEO}) t`,
        params);
    const [rows] = await pool.query(
        `${SELECT_POST}${where} ORDER BY p.fecha_creacion DESC, p.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]);

    res.json({
        exito: true,
        posts: await serializarPosts(rows, req.usuario),
        paginacion: { page, limit, total, paginas: Math.ceil(total / limit) }
    });
}));

// Ranking semanal: posts de los ultimos 7 dias por likes, y comentarios como desempate.
// El orden (solo ids) se guarda 60 s en memoria: es igual para todos y calcularlo es lo mas caro del endpoint;
// los datos de cada post (likes, guardado, anonimato) se leen frescos.
router.get('/posts/ranking-semanal', requireAuth.opcional, asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);

    if (Date.now() > cacheRanking.hasta) {
        // si llegan muchas peticiones con la cache vencida, todas esperan un unico calculo
        if (!calculoRanking) {
            calculoRanking = pool.query(
                `SELECT p.id FROM posts p
                 WHERE p.fecha_creacion >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                 ORDER BY (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) DESC,
                          (SELECT COUNT(*) FROM comentarios co WHERE co.post_id = p.id) DESC,
                          p.fecha_creacion DESC
                 LIMIT 20`)
                .then(([ids]) => {
                    cacheRanking = { ids: ids.map((r) => r.id), hasta: Date.now() + (process.env.NODE_ENV === 'test' ? 0 : TTL_RANKING_MS) };
                })
                .finally(() => { calculoRanking = null; });
        }
        await calculoRanking;
    }

    const ids = cacheRanking.ids.slice(0, limit);
    if (ids.length === 0) return res.json({ exito: true, posts: [] });

    const [rows] = await pool.query(`${SELECT_POST} WHERE p.id IN (?)`, [ids]);
    // los posts borrados desde que se calculo el orden simplemente desaparecen de la lista
    rows.sort((x, y) => ids.indexOf(x.id) - ids.indexOf(y.id));
    res.json({ exito: true, posts: await serializarPosts(rows, req.usuario) });
}));

router.get('/posts/:id', requireAuth.opcional, asyncHandler(async (req, res) => {
    res.json(await obtenerPost(v.entero(req.params.id, 'El id'), req.usuario));
}));

router.post('/posts', requireAuth, subir('imagen', 'post'), asyncHandler(async (req, res) => {
    const titulo = v.texto(req.body.titulo, 'El titulo', { max: 120 });
    const contenido = v.texto(req.body.contenido, 'El contenido', { max: 3000 });
    const categoriaId = v.entero(req.body.categoriaId, 'La categoria');
    const tags = v.etiquetas(req.body.tags);
    const esAnonimo = v.booleano(req.body.esAnonimo) ? 1 : 0;

    const [categorias] = await pool.query('SELECT id FROM categorias WHERE id = ?', [categoriaId]);
    if (categorias.length === 0) throw new ErrorHttp(400, 'Categoría no encontrada');

    const tagIds = await resolverTags(tags);
    const imagenUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const postId = await conTransaccion(async (conexion) => {
        const [resultado] = await conexion.query(
            `INSERT INTO posts (titulo, contenido, imagen_url, es_anonimo, usuario_id, categoria_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [titulo, contenido, imagenUrl, esAnonimo, req.usuario.id, categoriaId]);
        for (const tagId of tagIds) {
            await conexion.query('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)', [resultado.insertId, tagId]);
        }
        return resultado.insertId;
    });

    await notificarMenciones({
        texto: `${titulo}\n${contenido}`,
        actor: esAnonimo ? null : await actorDe(req.usuario.id),
        postId,
        claveBase: `mencion:post:${postId}`
    });

    res.status(201).json(await obtenerPost(postId, req.usuario));
}));

router.put('/posts/:id', requireAuth, subir('imagen', 'post'), asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    const [rows] = await pool.query('SELECT * FROM posts WHERE id = ?', [id]);
    if (rows.length === 0) throw new ErrorHttp(404, 'Post no encontrado');
    const post = rows[0];

    // solo el autor edita
    if (post.usuario_id !== req.usuario.id) throw new ErrorHttp(403, 'No tienes permiso para editar este post');

    const titulo = v.texto(req.body.titulo, 'El titulo', { max: 120 });
    const contenido = v.texto(req.body.contenido, 'El contenido', { max: 3000 });
    const categoriaId = req.body.categoriaId ? v.entero(req.body.categoriaId, 'La categoria') : post.categoria_id;
    const tags = req.body.tags !== undefined ? v.etiquetas(req.body.tags) : null;

    const [categorias] = await pool.query('SELECT id FROM categorias WHERE id = ?', [categoriaId]);
    if (categorias.length === 0) throw new ErrorHttp(400, 'Categoría no encontrada');

    const tagIds = tags ? await resolverTags(tags) : null;
    const imagenNueva = req.file ? `/uploads/${req.file.filename}` : post.imagen_url;

    await conTransaccion(async (conexion) => {
        await conexion.query(
            `UPDATE posts SET titulo = ?, contenido = ?, categoria_id = ?, imagen_url = ?, editado = 1, editado_at = NOW()
             WHERE id = ?`, [titulo, contenido, categoriaId, imagenNueva, id]);
        if (tagIds) {
            await conexion.query('DELETE FROM post_tags WHERE post_id = ?', [id]);
            for (const tagId of tagIds) {
                await conexion.query('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)', [id, tagId]);
            }
        }
    });
    if (req.file && post.imagen_url) eliminarImagen(post.imagen_url);

    await notificarMenciones({
        texto: `${titulo}\n${contenido}`,
        actor: post.es_anonimo ? null : await actorDe(req.usuario.id),
        postId: id,
        claveBase: `mencion:post:${id}`
    });

    res.json(await obtenerPost(id, req.usuario));
}));

router.delete('/posts/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    const [rows] = await pool.query('SELECT usuario_id FROM posts WHERE id = ?', [id]);
    if (rows.length === 0) throw new ErrorHttp(404, 'Post no encontrado');

    const esAutor = rows[0].usuario_id === req.usuario.id;
    if (!esAutor && req.usuario.rol !== 'admin') {
        throw new ErrorHttp(403, 'No tienes permiso para eliminar este post');
    }

    await eliminarPost(id);
    if (!esAutor) await auditar(req.usuario.id, 'eliminar_post', 'post', id, 'Eliminado por un administrador');
    res.json({ exito: true, mensaje: 'Post eliminado' });
}));

router.post('/posts/:id/like', requireAuth, asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    const [posts] = await pool.query('SELECT usuario_id FROM posts WHERE id = ?', [id]);
    if (posts.length === 0) throw new ErrorHttp(404, 'Post no encontrado');

    const { creado, likes, likedByMe } = await toggleLike('post_likes', 'post_id', id, req.usuario.id);
    if (creado) {
        const actor = await actorDe(req.usuario.id);
        await crearNotificacion({
            destinoId: posts[0].usuario_id,
            actorId: req.usuario.id,
            tipo: 'like',
            mensaje: `@${actor.username} le dio like a tu publicación`,
            referenciaId: id,
            clave: `like:post:${id}:u${req.usuario.id}`
        });
    }
    res.json({ likes, likedByMe });
}));

router.post('/posts/:id/guardar', requireAuth, asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    const [posts] = await pool.query('SELECT id FROM posts WHERE id = ?', [id]);
    if (posts.length === 0) throw new ErrorHttp(404, 'Post no encontrado');

    let guardado = false;
    await reintentarDeadlock(async () => {
        const [borrado] = await pool.query('DELETE FROM guardados WHERE usuario_id = ? AND post_id = ?', [req.usuario.id, id]);
        guardado = false;
        if (borrado.affectedRows === 0) {
            // si dos clicks llegan a la vez, la PK compuesta deja un solo registro
            await ignorarDuplicado(() => pool.query('INSERT INTO guardados (usuario_id, post_id) VALUES (?, ?)', [req.usuario.id, id]));
            guardado = true;
        }
    });
    res.json({ exito: true, guardado });
}));

async function actorDe(usuarioId) {
    const [rows] = await pool.query('SELECT id, username FROM usuarios WHERE id = ?', [usuarioId]);
    return rows[0];
}

module.exports = router;
