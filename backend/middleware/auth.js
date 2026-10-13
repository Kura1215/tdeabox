const { verificarToken } = require('../config/jwt');

// revisa el header Authorization y mete el correo del usuario en req.correo
function requireAuth(req, res, next) {
    const header = req.headers['authorization'];

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    const token = header.substring(7);

    try {
        const payload = verificarToken(token);
        req.correo = payload.sub;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token invalido o expirado' });
    }
}

// igual que requireAuth pero sin bloquear: si hay token valido deja el correo, si no sigue de largo
requireAuth.opcional = function (req, res, next) {
    const header = req.headers['authorization'];
    if (header && header.startsWith('Bearer ')) {
        try {
            req.correo = verificarToken(header.substring(7)).sub;
        } catch (error) {
            // token invalido: se trata como visitante
        }
    }
    next();
};

module.exports = requireAuth;
