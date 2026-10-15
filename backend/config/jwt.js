require('dotenv').config();
const jwt = require('jsonwebtoken');

// la sesion dura 7 dias (RF01)
function generarToken(usuarioId) {
    return jwt.sign({ sub: String(usuarioId) }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRATION || '7d'
    });
}

function verificarToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { generarToken, verificarToken };
