// Rutas de autenticacion: solo leen y validan la peticion, llaman al servicio y responden.
// La logica de sesiones esta en services/auth.js.
const express = require('express');
const { subir } = require('../middleware/upload');
const { ErrorHttp, asyncHandler } = require('../utils/errores');
const v = require('../utils/validar');
const authService = require('../services/auth');

const router = express.Router();

const COOKIE_SESION = 'tdeavox_sesion';
const opcionesCookie = {
    httpOnly: true,                                // el JavaScript del navegador no la puede leer (XSS)
    sameSite: 'strict',                            // el navegador no la envia desde otros sitios (CSRF)
    secure: process.env.NODE_ENV === 'production', // en produccion solo viaja por HTTPS
    path: '/api/auth'                              // solo se envia a renovar y logout
};

// Proteccion CSRF de las rutas que usan la cookie: ademas de SameSite exigimos un header propio.
// Un formulario de otro sitio no puede agregar headers, y un fetch desde otro origen necesita
// permiso de CORS, que solo tienen los origenes de CORS_ORIGINS.
function exigirHeaderCsrf(req, res, next) {
    if (req.get('X-Requested-With') !== 'TdeaVox') return next(new ErrorHttp(403, 'Peticion no permitida'));
    next();
}

// guarda la cookie de renovacion y responde con el token de acceso y los datos del usuario
function responderSesion(res, status, { datos, tokenRenovacion, expira }, extra = {}) {
    res.cookie(COOKIE_SESION, tokenRenovacion, { ...opcionesCookie, expires: expira });
    res.status(status).json({ ...datos, ...extra });
}

router.post('/register', subir('foto', 'perfil'), asyncHandler(async (req, res) => {
    const sesion = await authService.registrar({
        nombre: v.texto(req.body.nombre, 'El nombre', { max: 100 }),
        username: v.username(req.body.username),
        correo: v.correoInstitucional(req.body.correo),
        password: v.password(req.body.password),
        fotoPerfil: req.file ? `/uploads/${req.file.filename}` : null
    });
    responderSesion(res, 201, sesion, { mensaje: 'Usuario registrado correctamente' });
}));

router.post('/login', asyncHandler(async (req, res) => {
    const { correo, password } = req.body;
    const sesion = await authService.iniciarSesion(
        typeof correo === 'string' ? correo.trim().toLowerCase() : '',
        typeof password === 'string' ? password : ''
    );
    responderSesion(res, 200, sesion);
}));

// Entrega un token de acceso nuevo usando la cookie (cuando el anterior vencio o al recargar la pagina)
router.post('/renovar', exigirHeaderCsrf, asyncHandler(async (req, res) => {
    try {
        res.json(await authService.renovar(req.cookies[COOKIE_SESION]));
    } catch (error) {
        res.clearCookie(COOKIE_SESION, opcionesCookie);
        throw error;
    }
}));

// Cierra la sesion en el servidor (revoca la cookie y los tokens de esa sesion)
router.post('/logout', exigirHeaderCsrf, asyncHandler(async (req, res) => {
    await authService.cerrarSesion(req.cookies[COOKIE_SESION]);
    res.clearCookie(COOKIE_SESION, opcionesCookie);
    res.json({ exito: true, mensaje: 'Sesion cerrada' });
}));

module.exports = router;
