const { verificarToken } = require('../config/jwt');
const { usuarioDeSesion } = require('../services/auth');
const { ErrorHttp, asyncHandler } = require('../utils/errores');

const NO_AUTORIZADO = 'No autorizado o sesion expirada';

// Lee el Bearer token y carga el usuario de su sesion: req.usuario = { id, correo, rol }.
// Devuelve null si no hay token; lanza 401 si el token es invalido, vencio o su sesion se cerro.
async function cargarUsuario(header) {
    if (!header) return null;
    if (!header.startsWith('Bearer ')) throw new ErrorHttp(401, NO_AUTORIZADO);

    let payload;
    try {
        payload = verificarToken(header.substring(7));
    } catch (error) {
        throw new ErrorHttp(401, NO_AUTORIZADO);
    }
    const usuario = payload.sid ? await usuarioDeSesion(payload.sid, payload.sub) : null;
    if (!usuario) throw new ErrorHttp(401, NO_AUTORIZADO);
    return usuario;
}

const requireAuth = asyncHandler(async (req, res, next) => {
    const usuario = await cargarUsuario(req.headers['authorization']);
    if (!usuario) throw new ErrorHttp(401, NO_AUTORIZADO);
    req.usuario = usuario;
    next();
});

// Igual que requireAuth pero sin token deja pasar como visitante.
// Un token vencido si da 401: asi el frontend lo renueva en vez de mostrar el feed como visitante.
requireAuth.opcional = asyncHandler(async (req, res, next) => {
    req.usuario = await cargarUsuario(req.headers['authorization']);
    next();
});

// debe ir despues de requireAuth
requireAuth.admin = (req, res, next) => {
    if (!req.usuario || req.usuario.rol !== 'admin') {
        return next(new ErrorHttp(403, 'Solo administradores'));
    }
    next();
};

module.exports = requireAuth;
