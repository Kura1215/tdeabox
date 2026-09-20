require('dotenv').config();
const jwt = require('jsonwebtoken');

function generarToken(correo) {
    return jwt.sign({ sub: correo }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRATION
    });
}

function verificarToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { generarToken, verificarToken };
