require('dotenv').config();
const jwt = require('jsonwebtoken');

// El token de acceso dura poco (15 min por defecto): si alguien lo roba, sirve muy poco tiempo.
// La sesion larga (7 dias, RF01) no es este token sino la cookie de renovacion (ver services/auth.js).
// `sid` es el id de la sesion en la BD: al cerrar sesion se borra y el token deja de servir al instante.
function generarToken(usuarioId, sesionId) {
    return jwt.sign({ sub: String(usuarioId), sid: sesionId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRATION || '15m'
    });
}

function verificarToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { generarToken, verificarToken };
