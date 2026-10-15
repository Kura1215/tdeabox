const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { ErrorHttp, asyncHandler } = require('../utils/errores');
const v = require('../utils/validar');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const { page, limit, offset } = v.paginacion(req.query, { porDefecto: 20, maxLimit: 50 });
    const soloNoLeidas = v.booleano(req.query.soloNoLeidas);
    const filtro = soloNoLeidas ? 'AND leido = 0' : '';

    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM notificaciones WHERE usuario_id = ? ${filtro}`, [req.usuario.id]);
    const [[{ noLeidas }]] = await pool.query(
        'SELECT COUNT(*) AS noLeidas FROM notificaciones WHERE usuario_id = ? AND leido = 0', [req.usuario.id]);
    const [rows] = await pool.query(
        `SELECT id, tipo, mensaje, referencia_id, leido, fecha FROM notificaciones
         WHERE usuario_id = ? ${filtro} ORDER BY fecha DESC, id DESC LIMIT ? OFFSET ?`,
        [req.usuario.id, limit, offset]);

    res.json({
        exito: true,
        notificaciones: rows.map((n) => ({
            id: n.id, tipo: n.tipo, mensaje: n.mensaje, referenciaId: n.referencia_id,
            leido: Boolean(n.leido), fecha: n.fecha
        })),
        noLeidas: Number(noLeidas),
        paginacion: { page, limit, total, paginas: Math.ceil(total / limit) }
    });
}));

router.post('/leer-todas', requireAuth, asyncHandler(async (req, res) => {
    await pool.query('UPDATE notificaciones SET leido = 1 WHERE usuario_id = ?', [req.usuario.id]);
    res.json({ exito: true, mensaje: 'Notificaciones marcadas como leídas' });
}));

// marca leida / no leida (body: { leido: true|false }, por defecto true)
router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    const leido = req.body.leido === undefined ? true : v.booleano(req.body.leido);

    const [resultado] = await pool.query(
        'UPDATE notificaciones SET leido = ? WHERE id = ? AND usuario_id = ?', [leido ? 1 : 0, id, req.usuario.id]);
    if (resultado.affectedRows === 0) {
        // affectedRows es 0 tambien cuando el valor ya era el mismo; distinguimos de "no existe"
        const [existe] = await pool.query('SELECT id FROM notificaciones WHERE id = ? AND usuario_id = ?', [id, req.usuario.id]);
        if (existe.length === 0) throw new ErrorHttp(404, 'Notificación no encontrada');
    }
    res.json({ exito: true, leido });
}));

module.exports = router;
