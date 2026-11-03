// Rutas de posts: solo leen y validan la peticion, llaman al servicio y responden.
// El acceso a la base de datos esta en services/posts.js.
const express = require('express');
const requireAuth = require('../middleware/auth');
const { subir } = require('../middleware/upload');
const { ErrorHttp, asyncHandler } = require('../utils/errores');
const v = require('../utils/validar');
const postsService = require('../services/posts');

const router = express.Router();

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function fechaQuery(valor, campo) {
    if (valor === undefined || valor === '') return null;
    if (typeof valor !== 'string' || !REGEX_FECHA.test(valor) || Number.isNaN(Date.parse(valor))) {
        throw new ErrorHttp(400, `${campo} debe tener formato AAAA-MM-DD`);
    }
    return valor;
}

const urlImagen = (req) => (req.file ? `/uploads/${req.file.filename}` : null);

router.get('/categorias', asyncHandler(async (req, res) => {
    res.json(await postsService.listarCategorias());
}));

// Feed paginado con filtros combinables
router.get('/posts', requireAuth.opcional, asyncHandler(async (req, res) => {
    const { categoria, tag, autor, q, siguiendo } = req.query;
    const filtros = {
        categoria: categoria ? v.entero(categoria, 'categoria') : null,
        tag: tag ? String(tag).trim().replace(/^#/, '').toLowerCase() : null,
        autor: autor ? String(autor).trim() : null,
        q: q ? v.texto(q, 'La busqueda', { max: 100 }) : null,
        desde: fechaQuery(req.query.desde, 'desde'),
        hasta: fechaQuery(req.query.hasta, 'hasta'),
        siguiendo: v.booleano(siguiendo)
    };
    const { posts, paginacion } = await postsService.listarFeed(filtros, v.paginacion(req.query), req.usuario);
    res.json({ exito: true, posts, paginacion });
}));

router.get('/posts/ranking-semanal', requireAuth.opcional, asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);
    res.json({ exito: true, posts: await postsService.rankingSemanal(limit, req.usuario) });
}));

router.get('/posts/:id', requireAuth.opcional, asyncHandler(async (req, res) => {
    res.json(await postsService.obtenerPost(v.entero(req.params.id, 'El id'), req.usuario));
}));

router.post('/posts', requireAuth, subir('imagen', 'post'), asyncHandler(async (req, res) => {
    const datos = {
        titulo: v.texto(req.body.titulo, 'El titulo', { max: 120 }),
        contenido: v.texto(req.body.contenido, 'El contenido', { max: 3000 }),
        categoriaId: v.entero(req.body.categoriaId, 'La categoria'),
        tags: v.etiquetas(req.body.tags),
        esAnonimo: v.booleano(req.body.esAnonimo),
        imagenUrl: urlImagen(req)
    };
    res.status(201).json(await postsService.crearPost(datos, req.usuario));
}));

router.put('/posts/:id', requireAuth, subir('imagen', 'post'), asyncHandler(async (req, res) => {
    const id = v.entero(req.params.id, 'El id');
    const datos = {
        titulo: v.texto(req.body.titulo, 'El titulo', { max: 120 }),
        contenido: v.texto(req.body.contenido, 'El contenido', { max: 3000 }),
        categoriaId: req.body.categoriaId ? v.entero(req.body.categoriaId, 'La categoria') : null,
        tags: req.body.tags !== undefined ? v.etiquetas(req.body.tags) : null,
        imagenUrl: urlImagen(req)
    };
    res.json(await postsService.editarPost(id, datos, req.usuario));
}));

router.delete('/posts/:id', requireAuth, asyncHandler(async (req, res) => {
    await postsService.borrarPost(v.entero(req.params.id, 'El id'), req.usuario);
    res.json({ exito: true, mensaje: 'Post eliminado' });
}));

router.post('/posts/:id/like', requireAuth, asyncHandler(async (req, res) => {
    res.json(await postsService.darLike(v.entero(req.params.id, 'El id'), req.usuario));
}));

router.post('/posts/:id/guardar', requireAuth, asyncHandler(async (req, res) => {
    const guardado = await postsService.alternarGuardado(v.entero(req.params.id, 'El id'), req.usuario);
    res.json({ exito: true, guardado });
}));

module.exports = router;
