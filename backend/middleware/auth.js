const pool = require('../db');
const { verificarToken } = require('../config/jwt');
const { ErrorHttp, asyncHandler } = require('../utils/errores');

// Lee el Bearer token y carga el usuario desde la BD: req.usuario = { id, correo, rol }.
// Leer el rol de la BD (y no del token) permite que quitar el admin o borrar un usuario surta efecto de inmediato.
async function cargarUsuario(header) {
    if (!header || !header.startsWith('Bearer ')) return null;
    let payload;
    try {
        payload = verificarToken(header.substring(7));
    } catch (error) {
        return null;
    }
    const [rows] = await pool.query('SELECT id, correo, rol FROM usuarios WHERE id = ?', [payload.sub]);
    return rows[0] || null;
}

const requireAuth = asyncHandler(async (req, res, next) => {
    const usuario = await cargarUsuario(req.headers['authorization']);
    if (!usuario) throw new ErrorHttp(401, 'No autorizado o sesion expirada');
    req.usuario = usuario;
    next();
});

// igual que requireAuth pero sin bloquear: si hay token valido deja el usuario, si no sigue como visitante
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
