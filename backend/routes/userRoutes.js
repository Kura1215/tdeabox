const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { subir, eliminarImagen } = require('../middleware/upload');
const { ErrorHttp, asyncHandler, ignorarDuplicado, reintentarDeadlock } = require('../utils/errores');
const v = require('../utils/validar');
const { crearNotificacion } = require('../services/notificaciones');
const { SELECT_POST, serializarPosts } = require('../services/posts');

const router = express.Router();

const LIKES_POPULAR = 10;
const COMENTARIOS_ACTIVO = 10;

// Estadisticas e insignias (RF12). En la vista publica solo cuentan los posts no anonimos,
// para no revelar con los numeros que alguien escribio un post anonimo.
async function estadisticas(usuarioId, publico) {
    const filtroAnonimo = publico ? 'AND es_anonimo = 0' : '';

    const [[{ posts }]] = await pool.query(
        `SELECT COUNT(*) AS posts FROM posts WHERE usuario_id = ? ${filtroAnonimo}`, [usuarioId]);
    const [[{ comentarios }]] = await pool.query(
        'SELECT COUNT(*) AS comentarios FROM comentarios WHERE usuario_id = ?', [usuarioId]);
    const [[{ likesRecibidos }]] = await pool.query(
        `SELECT COUNT(*) AS likesRecibidos FROM post_likes l JOIN posts p ON p.id = l.post_id
         WHERE p.usuario_id = ? ${publico ? 'AND p.es_anonimo = 0' : ''}`, [usuarioId]);
    const [[{ seguidores }]] = await pool.query(
        'SELECT COUNT(*) AS seguidores FROM seguidores WHERE seguido_id = ?', [usuarioId]);
    const [[{ seguidos }]] = await pool.query(
        'SELECT COUNT(*) AS seguidos FROM seguidores WHERE seguidor_id = ?', [usuarioId]);
    const [popular] = await pool.query(
        `SELECT p.id FROM posts p JOIN post_likes l ON l.post_id = p.id
         WHERE p.usuario_id = ? AND p.es_anonimo = 0
         GROUP BY p.id HAVING COUNT(*) >= ? LIMIT 1`, [usuarioId, LIKES_POPULAR]);

    const insignias = [];
    if (popular.length > 0) insignias.push('Popular');
    if (Number(comentarios) >= COMENTARIOS_ACTIVO) insignias.push('Activo');

    return {
        estadisticas: {
            posts: Number(posts), comentarios: Number(comentarios), likesRecibidos: Number(likesRecibidos)
        },
        seguidores: Number(seguidores),
        seguidos: Number(seguidos),
        insignias
    };
}

async function postsDeUsuario(usuarioId, publico, usuarioActual, { page, limit, offset }) {
    const filtro = publico ? 'AND p.es_anonimo = 0' : '';
    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM posts p WHERE p.usuario_id = ? ${filtro}`, [usuarioId]);
    const [rows] = await pool.query(
        `${SELECT_POST} WHERE p.usuario_id = ? ${filtro}
         ORDER BY p.fecha_creacion DESC, p.id DESC LIMIT ? OFFSET ?`, [usuarioId, limit, offset]);
    return {
        posts: await serializarPosts(rows, usuarioActual),
        paginacion: { page, limit, total, paginas: Math.ceil(total / limit) }
    };
}

function perfilBase(u) {
    return {
        id: u.id,
        nombre: u.nombre,
        username: u.username,
        fotoPerfil: u.foto_perfil || '',
        biografia: u.biografia || '',
        programaAcademico: u.programa_academico || '',
        rol: u.rol,
        fechaRegistro: u.fecha_registro
    };
}

// Datos ligeros de la sesion: el frontend los consulta al arrancar para refrescar el rol
// (si se vuelve admin a alguien en la BD, no tiene que cerrar sesion para ver el panel)
router.get('/me/sesion', requireAuth, asyncHandler(async (req, res) => {
    const [[u]] = await pool.query('SELECT id, nombre, username, foto_perfil, rol FROM usuarios WHERE id = ?', [req.usuario.id]);
    res.json({ exito: true, usuarioId: u.id, nombre: u.nombre, username: u.username, fotoPerfil: u.foto_perfil || '', rol: u.rol });
}));

// Vista del perfil propio (con correo y posts anonimos incluidos)
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
    const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.usuario.id]);
    const u = usuarios[0];
    const { posts, paginacion } = await postsDeUsuario(u.id, false, req.usuario, v.paginacion(req.query, { maxLimit: 20 }));

    res.json({
        ...perfilBase(u),
        correo: u.correo,
        ...(await estadisticas(u.id, false)),
        posts,
        paginacion
    });
}));

router.put('/me', requireAuth, subir('foto', 'perfil'), asyncHandler(async (req, res) => {
    const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.usuario.id]);
    const u = usuarios[0];

    const nombre = req.body.nombre !== undefined && req.body.nombre.trim() !== ''
        ? v.texto(req.body.nombre, 'El nombre', { max: 100 })
        : u.nombre;
    const biografia = req.body.biografia !== undefined
        ? v.texto(req.body.biografia, 'La biografia', { max: 200, requerido: false })
        : u.biografia;
    const programa = req.body.programaAcademico !== undefined
        ? v.texto(req.body.programaAcademico, 'El programa academico', { max: 80, requerido: false })
        : u.programa_academico;

    const fotoPerfil = req.file ? `/uploads/${req.file.filename}` : u.foto_perfil;

    await pool.query(
        'UPDATE usuarios SET nombre = ?, biografia = ?, programa_academico = ?, foto_perfil = ? WHERE id = ?',
        [nombre, biografia, programa, fotoPerfil, u.id]);
    if (req.file && u.foto_perfil) eliminarImagen(u.foto_perfil);

    res.json({
        ...perfilBase({ ...u, nombre, biografia, programa_academico: programa, foto_perfil: fotoPerfil }),
        correo: u.correo
    });
}));

// Publicaciones guardadas: lista privada, solo el dueño la ve
router.get('/me/guardados', requireAuth, asyncHandler(async (req, res) => {
    const { page, limit, offset } = v.paginacion(req.query);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM guardados WHERE usuario_id = ?', [req.usuario.id]);
    const [rows] = await pool.query(
        `${SELECT_POST} JOIN guardados g ON g.post_id = p.id
         WHERE g.usuario_id = ? ORDER BY g.fecha DESC, p.id DESC LIMIT ? OFFSET ?`,
        [req.usuario.id, limit, offset]);
    res.json({
        exito: true,
        posts: await serializarPosts(rows, req.usuario),
        paginacion: { page, limit, total, paginas: Math.ceil(total / limit) }
    });
}));

// Perfil publico de otro usuario (sin correo y sin posts anonimos)
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (usuarios.length === 0) throw new ErrorHttp(404, 'Usuario no encontrado');
    const u = usuarios[0];

    const [sigo] = await pool.query(
        'SELECT 1 FROM seguidores WHERE seguidor_id = ? AND seguido_id = ?', [req.usuario.id, id]);
    const { posts, paginacion } = await postsDeUsuario(id, true, req.usuario, v.paginacion(req.query, { maxLimit: 20 }));

    res.json({
        ...perfilBase(u),
        ...(await estadisticas(id, true)),
        siguiendo: sigo.length > 0,
        esMio: id === req.usuario.id,
        posts,
        paginacion
    });
}));

router.post('/:id/seguir', requireAuth, asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    if (id === req.usuario.id) throw new ErrorHttp(400, 'No puedes seguirte a ti mismo');

    const [usuarios] = await pool.query('SELECT id FROM usuarios WHERE id = ?', [id]);
    if (usuarios.length === 0) throw new ErrorHttp(404, 'Usuario no encontrado');

    let siguiendo = false;
    let creado = false;
    await reintentarDeadlock(async () => {
        const [borrado] = await pool.query(
            'DELETE FROM seguidores WHERE seguidor_id = ? AND seguido_id = ?', [req.usuario.id, id]);
        siguiendo = false;
        creado = false;
        if (borrado.affectedRows === 0) {
            // PK compuesta: si dos peticiones llegan a la vez, solo una inserta y la otra queda como "ya sigue"
            siguiendo = true;
            creado = await ignorarDuplicado(async () => {
                await pool.query('INSERT INTO seguidores (seguidor_id, seguido_id) VALUES (?, ?)', [req.usuario.id, id]);
                return true;
            }, false);
        }
    });

    if (creado) {
        const [[actor]] = await pool.query('SELECT username FROM usuarios WHERE id = ?', [req.usuario.id]);
        await crearNotificacion({
            destinoId: id,
            actorId: req.usuario.id,
            tipo: 'seguidor',
            mensaje: `@${actor.username} empezó a seguirte`,
            referenciaId: req.usuario.id,
            clave: `seguidor:u${req.usuario.id}`
        });
    }

    const [[{ seguidores }]] = await pool.query('SELECT COUNT(*) AS seguidores FROM seguidores WHERE seguido_id = ?', [id]);
    res.json({ exito: true, siguiendo, seguidores: Number(seguidores) });
}));

async function listarRelacion(req, res, columnaFiltro, columnaUsuario) {
    const id = v.entero(req.params.id, 'El id');
    const [usuarios] = await pool.query('SELECT id FROM usuarios WHERE id = ?', [id]);
    if (usuarios.length === 0) throw new ErrorHttp(404, 'Usuario no encontrado');

    const { page, limit, offset } = v.paginacion(req.query, { porDefecto: 20, maxLimit: 50 });
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM seguidores WHERE ${columnaFiltro} = ?`, [id]);
    const [rows] = await pool.query(
        `SELECT u.id, u.nombre, u.username, u.foto_perfil FROM seguidores s
         JOIN usuarios u ON u.id = s.${columnaUsuario}
         WHERE s.${columnaFiltro} = ? ORDER BY s.fecha DESC LIMIT ? OFFSET ?`, [id, limit, offset]);

    res.json({
        exito: true,
        usuarios: rows.map((u) => ({ id: u.id, nombre: u.nombre, username: u.username, fotoPerfil: u.foto_perfil || '' })),
        paginacion: { page, limit, total, paginas: Math.ceil(total / limit) }
    });
}

router.get('/:id/seguidores', requireAuth, asyncHandler((req, res) => listarRelacion(req, res, 'seguido_id', 'seguidor_id')));
router.get('/:id/seguidos', requireAuth, asyncHandler((req, res) => listarRelacion(req, res, 'seguidor_id', 'seguido_id')));

module.exports = router;
