// Rutas de reportes: solo leen y validan la peticion, llaman al servicio y responden.
// El acceso a la base de datos esta en services/reportes.js.
const express = require('express');
const requireAuth = require('../middleware/auth');
const { ErrorHttp, asyncHandler } = require('../utils/errores');
const v = require('../utils/validar');
const { crearReporte } = require('../services/reportes');

const router = express.Router();

const MOTIVOS = ['spam', 'contenido_inapropiado', 'otro'];

router.post('/', requireAuth, asyncHandler(async (req, res) => {
    const { tipo, motivo } = req.body;
    if (tipo !== 'post' && tipo !== 'comentario') throw new ErrorHttp(400, 'El tipo debe ser "post" o "comentario"');
    if (!MOTIVOS.includes(motivo)) throw new ErrorHttp(400, `El motivo debe ser: ${MOTIVOS.join(', ')}`);

    const datos = {
        tipo,
        motivo,
        id: v.entero(req.body.id, 'El id del contenido'),
        descripcion: v.texto(req.body.descripcion, 'La descripcion', { max: 300, requerido: motivo === 'otro' })
    };
    await crearReporte(datos, req.usuario);
    res.status(201).json({ exito: true, mensaje: 'Reporte enviado. Gracias por ayudar a moderar.' });
}));

module.exports = router;
