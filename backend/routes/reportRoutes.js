const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { ErrorHttp, asyncHandler } = require('../utils/errores');
const v = require('../utils/validar');

const router = express.Router();

const MOTIVOS = ['spam', 'contenido_inapropiado', 'otro'];

// Reporta un post o comentario (RF08). Un usuario solo puede reportar una vez el mismo contenido (UNIQUE en BD).
router.post('/', requireAuth, asyncHandler(async (req, res) => {
    const { tipo, motivo } = req.body;
    if (tipo !== 'post' && tipo !== 'comentario') throw new ErrorHttp(400, 'El tipo debe ser "post" o "comentario"');
    if (!MOTIVOS.includes(motivo)) throw new ErrorHttp(400, `El motivo debe ser: ${MOTIVOS.join(', ')}`);

    const id = v.entero(req.body.id, 'El id del contenido');
    const descripcion = v.texto(req.body.descripcion, 'La descripcion', { max: 300, requerido: motivo === 'otro' });

    const tabla = tipo === 'post' ? 'posts' : 'comentarios';
    const [existe] = await pool.query(`SELECT id FROM ${tabla} WHERE id = ?`, [id]);
    if (existe.length === 0) throw new ErrorHttp(404, 'El contenido que intentas reportar no existe');

    try {
        await pool.query(
            `INSERT INTO reportes (reportante_id, post_id, comentario_id, tipo_objetivo, motivo, descripcion)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.usuario.id, tipo === 'post' ? id : null, tipo === 'comentario' ? id : null, tipo, motivo, descripcion]);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') throw new ErrorHttp(409, 'Ya reportaste este contenido');
        throw error;
    }

    res.status(201).json({ exito: true, mensaje: 'Reporte enviado. Gracias por ayudar a moderar.' });
}));

module.exports = router;
