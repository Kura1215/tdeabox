// Rutas de usuarios: solo leen y validan la peticion, llaman al servicio y responden.
// El acceso a la base de datos esta en services/usuarios.js.
const express = require('express');
const requireAuth = require('../middleware/auth');
const { subir } = require('../middleware/upload');
const { asyncHandler } = require('../utils/errores');
const v = require('../utils/validar');
const usuariosService = require('../services/usuarios');
const { listarGuardados } = require('../services/posts');

const router = express.Router();

// Datos ligeros de la sesion (nombre, foto y rol actuales)
router.get('/me/sesion', requireAuth, asyncHandler(async (req, res) => {
    res.json({ exito: true, ...(await usuariosService.datosSesion(req.usuario.id)) });
}));

// Vista del perfil propio (con correo y posts anonimos incluidos)
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
    res.json(await usuariosService.perfilPropio(req.usuario, v.paginacion(req.query, { maxLimit: 20 })));
}));

router.put('/me', requireAuth, subir('foto', 'perfil'), asyncHandler(async (req, res) => {
    const { nombre, biografia, programaAcademico } = req.body;
    // un nombre vacio no borra el actual; biografia y programa vacios si se borran
    const datos = {
        nombre: typeof nombre === 'string' && nombre.trim() !== '' ? v.texto(nombre, 'El nombre', { max: 100 }) : undefined,
        biografia: biografia !== undefined
            ? v.texto(biografia, 'La biografia', { max: 200, requerido: false }) : undefined,
        programaAcademico: programaAcademico !== undefined
            ? v.texto(programaAcademico, 'El programa academico', { max: 80, requerido: false }) : undefined,
        fotoPerfil: req.file ? `/uploads/${req.file.filename}` : null
    };
    res.json(await usuariosService.editarPerfil(req.usuario.id, datos));
}));

// Publicaciones guardadas: lista privada, solo el dueño la ve
router.get('/me/guardados', requireAuth, asyncHandler(async (req, res) => {
    res.json({ exito: true, ...(await listarGuardados(req.usuario, v.paginacion(req.query))) });
}));

// Perfil publico de otro usuario (sin correo y sin posts anonimos)
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    res.json(await usuariosService.perfilPublico(id, req.usuario, v.paginacion(req.query, { maxLimit: 20 })));
}));

router.post('/:id/seguir', requireAuth, asyncHandler(async (req, res) => {
    const resultado = await usuariosService.alternarSeguir(v.entero(req.params.id, 'El id'), req.usuario);
    res.json({ exito: true, ...resultado });
}));

function listarRelacion(tipo) {
    return asyncHandler(async (req, res) => {
        const id = v.entero(req.params.id, 'El id');
        const pag = v.paginacion(req.query, { porDefecto: 20, maxLimit: 50 });
        res.json({ exito: true, ...(await usuariosService.listarRelacion(id, tipo, pag)) });
    });
}

router.get('/:id/seguidores', requireAuth, listarRelacion('seguidores'));
router.get('/:id/seguidos', requireAuth, listarRelacion('seguidos'));

module.exports = router;
