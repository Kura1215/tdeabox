// Rutas de notificaciones: solo leen y validan la peticion, llaman al servicio y responden.
// El acceso a la base de datos esta en services/notificaciones.js.
const express = require('express');
const requireAuth = require('../middleware/auth');
const { asyncHandler } = require('../utils/errores');
const v = require('../utils/validar');
const notificacionesService = require('../services/notificaciones');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const pag = v.paginacion(req.query, { porDefecto: 20, maxLimit: 50 });
    const soloNoLeidas = v.booleano(req.query.soloNoLeidas);
    res.json({ exito: true, ...(await notificacionesService.listarNotificaciones(req.usuario.id, soloNoLeidas, pag)) });
}));

router.post('/leer-todas', requireAuth, asyncHandler(async (req, res) => {
    await notificacionesService.marcarTodasLeidas(req.usuario.id);
    res.json({ exito: true, mensaje: 'Notificaciones marcadas como leídas' });
}));

// marca leida / no leida (body: { leido: true|false }, por defecto true)
router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    const leido = req.body.leido === undefined ? true : v.booleano(req.body.leido);
    await notificacionesService.marcarNotificacion(id, req.usuario.id, leido);
    res.json({ exito: true, leido });
}));

module.exports = router;
