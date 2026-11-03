require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const { manejarErrores, noEncontrado } = require('./middleware/errores');
const { uploadsDir } = require('./middleware/upload');
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminRoutes = require('./routes/adminRoutes');

function crearApp({ authRateMax = Number(process.env.AUTH_RATE_MAX) || 30 } = {}) {
    const app = express();

    // detras de un proxy (nginx, etc.) para leer bien la IP y el protocolo
    app.set('trust proxy', 1);

    // en produccion exigimos HTTPS (RNF03); el proxy debe enviar X-Forwarded-Proto
    if (process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS !== 'false') {
        app.use((req, res, next) => {
            if (req.secure) return next();
            res.status(426).json({ exito: false, error: 'Se requiere HTTPS', mensaje: 'Se requiere HTTPS' });
        });
    }

    // las imagenes de /uploads las carga el frontend desde otro origen
    app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

    const origenes = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
        .split(',').map((o) => o.trim()).filter(Boolean);
    app.use(cors({
        origin: origenes,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: true
    }));

    if (process.env.NODE_ENV !== 'test') {
        app.use((req, res, next) => {
            const inicio = Date.now();
            res.on('finish', () => console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - inicio}ms`));
            next();
        });
    }

    app.use(express.json({ limit: '100kb' }));
    // lee la cookie HttpOnly de la sesion (solo la usan /api/auth/renovar y /api/auth/logout)
    app.use(cookieParser());
    app.use('/uploads', express.static(uploadsDir));

    // freno a fuerza bruta en registro y login
    const limitadorAuth = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: authRateMax,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => res.status(429).json({
            exito: false,
            error: 'Demasiados intentos. Intenta de nuevo en unos minutos.',
            mensaje: 'Demasiados intentos. Intenta de nuevo en unos minutos.'
        })
    });

    // el limite aplica solo a registro y login: renovar el token no debe gastar intentos
    app.use(['/api/auth/login', '/api/auth/register'], limitadorAuth);
    app.use('/api/auth', authRoutes);
    app.use('/api', postRoutes);
    app.use('/api', commentRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/notificaciones', notificationRoutes);
    app.use('/api/reportes', reportRoutes);
    app.use('/api/admin', adminRoutes);

    app.use(noEncontrado);
    app.use(manejarErrores);
    return app;
}

module.exports = { crearApp };
