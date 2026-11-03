// Rutas del panel de administracion: solo leen y validan la peticion, llaman al servicio y responden.
// El acceso a la base de datos esta en services/reportes.js y services/admin.js.
const express = require('express');
const requireAuth = require('../middleware/auth');
const { ErrorHttp, asyncHandler } = require('../utils/errores');
const v = require('../utils/validar');
const { listarReportes, resolverReporte } = require('../services/reportes');
const adminService = require('../services/admin');

const router = express.Router();

// Todo /api/admin exige sesion y rol admin
router.use(requireAuth, requireAuth.admin);

const ESTADOS = ['pendiente', 'revisado', 'descartado'];

router.get('/reportes', asyncHandler(async (req, res) => {
    const pag = v.paginacion(req.query, { porDefecto: 20, maxLimit: 50 });
    const { estado } = req.query;
    if (estado && !ESTADOS.includes(estado)) throw new ErrorHttp(400, `estado debe ser: ${ESTADOS.join(', ')}`);
    res.json({ exito: true, ...(await listarReportes(estado, pag)) });
}));

// Cambia el estado de un reporte; con eliminarContenido=true tambien borra el contenido reportado
router.patch('/reportes/:id', asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    const { estado } = req.body;
    if (estado !== 'revisado' && estado !== 'descartado') {
        throw new ErrorHttp(400, 'estado debe ser "revisado" o "descartado"');
    }
    await resolverReporte(id, estado, v.booleano(req.body.eliminarContenido), req.usuario);
    res.json({ exito: true, mensaje: 'Reporte actualizado', estado });
}));

router.delete('/posts/:id', asyncHandler(async (req, res) => {
    await adminService.borrarPostAdmin(v.entero(req.params.id, 'El id'), req.usuario);
    res.json({ exito: true, mensaje: 'Post eliminado' });
}));

router.delete('/comentarios/:id', asyncHandler(async (req, res) => {
    await adminService.borrarComentarioAdmin(v.entero(req.params.id, 'El id'), req.usuario);
    res.json({ exito: true, mensaje: 'Comentario eliminado' });
}));

router.get('/auditoria', asyncHandler(async (req, res) => {
    const pag = v.paginacion(req.query, { porDefecto: 20, maxLimit: 50 });
    res.json({ exito: true, ...(await adminService.listarAuditoria(pag)) });
}));

module.exports = router;
