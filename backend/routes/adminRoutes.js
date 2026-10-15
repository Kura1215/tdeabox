const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { ErrorHttp, asyncHandler } = require('../utils/errores');
const v = require('../utils/validar');
const { eliminarPost, eliminarComentario } = require('../services/contenido');
const { auditar } = require('../services/auditoria');

const router = express.Router();

// Todo /api/admin exige sesion y rol admin
router.use(requireAuth, requireAuth.admin);

const ESTADOS = ['pendiente', 'revisado', 'descartado'];

// Reportes con el contenido reportado y su autor real (el admin si puede ver autores de posts anonimos)
router.get('/reportes', asyncHandler(async (req, res) => {
    const { page, limit, offset } = v.paginacion(req.query, { porDefecto: 20, maxLimit: 50 });
    const { estado } = req.query;
    if (estado && !ESTADOS.includes(estado)) throw new ErrorHttp(400, `estado debe ser: ${ESTADOS.join(', ')}`);

    const filtro = estado ? 'WHERE r.estado = ?' : '';
    const params = estado ? [estado] : [];

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM reportes r ${filtro}`, params);
    const [rows] = await pool.query(
        `SELECT r.id, r.tipo_objetivo, r.motivo, r.descripcion, r.estado, r.fecha, r.post_id, r.comentario_id,
                rep.id AS reportante_id, rep.username AS reportante_username,
                p.titulo AS post_titulo, p.contenido AS post_contenido, p.es_anonimo,
                co.contenido AS comentario_contenido, co.post_id AS comentario_post_id,
                au.id AS autor_id, au.nombre AS autor_nombre, au.username AS autor_username
         FROM reportes r
         JOIN usuarios rep ON rep.id = r.reportante_id
         LEFT JOIN posts p ON p.id = r.post_id
         LEFT JOIN comentarios co ON co.id = r.comentario_id
         LEFT JOIN usuarios au ON au.id = COALESCE(p.usuario_id, co.usuario_id)
         ${filtro}
         ORDER BY (r.estado = 'pendiente') DESC, r.fecha DESC, r.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]);

    res.json({
        exito: true,
        reportes: rows.map((r) => ({
            id: r.id,
            tipo: r.tipo_objetivo,
            motivo: r.motivo,
            descripcion: r.descripcion || '',
            estado: r.estado,
            fecha: r.fecha,
            reportante: { id: r.reportante_id, username: r.reportante_username },
            contenidoEliminado: r.post_id === null && r.comentario_id === null,
            contenido: r.tipo_objetivo === 'post'
                ? (r.post_id ? { id: r.post_id, titulo: r.post_titulo, texto: r.post_contenido, esAnonimo: Boolean(r.es_anonimo) } : null)
                : (r.comentario_id ? { id: r.comentario_id, texto: r.comentario_contenido, postId: r.comentario_post_id } : null),
            autorReal: r.autor_id ? { id: r.autor_id, nombre: r.autor_nombre, username: r.autor_username } : null
        })),
        paginacion: { page, limit, total, paginas: Math.ceil(total / limit) }
    });
}));

// Cambia el estado de un reporte; con eliminarContenido=true tambien borra el contenido reportado
router.patch('/reportes/:id', asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    const { estado } = req.body;
    if (estado !== 'revisado' && estado !== 'descartado') {
        throw new ErrorHttp(400, 'estado debe ser "revisado" o "descartado"');
    }
    const eliminar = v.booleano(req.body.eliminarContenido);

    const [rows] = await pool.query('SELECT * FROM reportes WHERE id = ?', [id]);
    if (rows.length === 0) throw new ErrorHttp(404, 'Reporte no encontrado');
    const reporte = rows[0];

    if (eliminar && estado === 'descartado') {
        throw new ErrorHttp(400, 'No se puede descartar un reporte y eliminar el contenido a la vez');
    }

    await pool.query('UPDATE reportes SET estado = ? WHERE id = ?', [estado, id]);
    await auditar(req.usuario.id, `reporte_${estado}`, 'reporte', id, `Reporte de ${reporte.tipo_objetivo} por ${reporte.motivo}`);

    if (eliminar) {
        if (reporte.post_id) {
            // el resto de reportes del mismo contenido tambien quedan resueltos
            await pool.query("UPDATE reportes SET estado = 'revisado' WHERE post_id = ? AND estado = 'pendiente'", [reporte.post_id]);
            await eliminarPost(reporte.post_id);
            await auditar(req.usuario.id, 'eliminar_post', 'post', reporte.post_id, `Desde el reporte #${id}`);
        } else if (reporte.comentario_id) {
            await pool.query("UPDATE reportes SET estado = 'revisado' WHERE comentario_id = ? AND estado = 'pendiente'", [reporte.comentario_id]);
            await eliminarComentario(reporte.comentario_id);
            await auditar(req.usuario.id, 'eliminar_comentario', 'comentario', reporte.comentario_id, `Desde el reporte #${id}`);
        }
    }

    res.json({ exito: true, mensaje: 'Reporte actualizado', estado });
}));

router.delete('/posts/:id', asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    const [rows] = await pool.query('SELECT id FROM posts WHERE id = ?', [id]);
    if (rows.length === 0) throw new ErrorHttp(404, 'Post no encontrado');

    await eliminarPost(id);
    await auditar(req.usuario.id, 'eliminar_post', 'post', id, 'Eliminado desde el panel de administración');
    res.json({ exito: true, mensaje: 'Post eliminado' });
}));

router.delete('/comentarios/:id', asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    const [rows] = await pool.query('SELECT id FROM comentarios WHERE id = ?', [id]);
    if (rows.length === 0) throw new ErrorHttp(404, 'Comentario no encontrado');

    await eliminarComentario(id);
    await auditar(req.usuario.id, 'eliminar_comentario', 'comentario', id, 'Eliminado desde el panel de administración');
    res.json({ exito: true, mensaje: 'Comentario eliminado' });
}));

router.get('/auditoria', asyncHandler(async (req, res) => {
    const { page, limit, offset } = v.paginacion(req.query, { porDefecto: 20, maxLimit: 50 });
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM auditoria_admin');
    const [rows] = await pool.query(
        `SELECT a.id, a.accion, a.entidad, a.entidad_id, a.detalle, a.fecha, u.username AS admin
         FROM auditoria_admin a LEFT JOIN usuarios u ON u.id = a.admin_id
         ORDER BY a.fecha DESC, a.id DESC LIMIT ? OFFSET ?`, [limit, offset]);

    res.json({
        exito: true,
        registros: rows.map((a) => ({
            id: a.id, accion: a.accion, entidad: a.entidad, entidadId: a.entidad_id,
            detalle: a.detalle || '', fecha: a.fecha, admin: a.admin || '(eliminado)'
        })),
        paginacion: { page, limit, total, paginas: Math.ceil(total / limit) }
    });
}));

module.exports = router;
