// Rutas de comentarios: solo leen y validan la peticion, llaman al servicio y responden.
// El acceso a la base de datos esta en services/comentarios.js.
const express = require('express');
const requireAuth = require('../middleware/auth');
const { subir } = require('../middleware/upload');
const { asyncHandler } = require('../utils/errores');
const v = require('../utils/validar');
const comentariosService = require('../services/comentarios');

const router = express.Router();

const urlImagen = (req) => (req.file ? `/uploads/${req.file.filename}` : null);

// Comentarios raiz paginados, cada uno con sus respuestas (un solo nivel)
router.get('/posts/:id/comentarios', requireAuth.opcional, asyncHandler(async (req, res) => {
    const postId = v.entero(req.params.id, 'El id');
    const pag = v.paginacion(req.query, { porDefecto: 20, maxLimit: 50 });
    res.json({ exito: true, ...(await comentariosService.listarComentarios(postId, req.usuario, pag)) });
}));

router.post('/posts/:id/comentarios', requireAuth, subir('imagen', 'comentario'), asyncHandler(async (req, res) => {
    const datos = {
        postId: v.entero(req.params.id, 'El id'),
        padreId: req.body.comentarioPadreId ? v.entero(req.body.comentarioPadreId, 'El comentario padre') : null,
        contenido: v.texto(req.body.contenido, 'El comentario', { max: 500 }),
        imagenUrl: urlImagen(req)
    };
    res.status(201).json(await comentariosService.crearComentario(datos, req.usuario));
}));

router.post('/comentarios/:id/respuestas', requireAuth, subir('imagen', 'comentario'), asyncHandler(async (req, res) => {
    const datos = {
        postId: null,
        padreId: v.entero(req.params.id, 'El id'),
        contenido: v.texto(req.body.contenido, 'El comentario', { max: 500 }),
        imagenUrl: urlImagen(req)
    };
    res.status(201).json(await comentariosService.crearComentario(datos, req.usuario));
}));

router.put('/comentarios/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    const contenido = v.texto(req.body.contenido, 'El comentario', { max: 500 });
    res.json(await comentariosService.editarComentario(id, contenido, req.usuario));
}));

router.post('/comentarios/:id/like', requireAuth, asyncHandler(async (req, res) => {
    res.json(await comentariosService.darLike(v.entero(req.params.id, 'El id'), req.usuario));
}));

router.delete('/comentarios/:id', requireAuth, asyncHandler(async (req, res) => {
    await comentariosService.borrarComentario(v.entero(req.params.id, 'El id'), req.usuario);
    res.json({ exito: true, mensaje: 'Comentario eliminado correctamente' });
}));

module.exports = router;
