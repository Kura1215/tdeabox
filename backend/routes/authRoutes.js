const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { generarToken } = require('../config/jwt');
const { subir } = require('../middleware/upload');
const { ErrorHttp, asyncHandler } = require('../utils/errores');
const v = require('../utils/validar');

const router = express.Router();

// hash de relleno para que login tarde igual exista o no el correo (evita enumerar usuarios por tiempo)
const HASH_FALSO = bcrypt.hashSync('relleno-contra-timing', 10);

// misma forma para registro y login
function respuestaSesion(u, extra = {}) {
    return {
        exito: true,
        token: generarToken(u.id),
        usuarioId: u.id,
        nombre: u.nombre,
        username: u.username,
        fotoPerfil: u.foto_perfil || '',
        rol: u.rol || 'usuario',
        ...extra
    };
}

router.post('/register', subir('foto', 'perfil'), asyncHandler(async (req, res) => {
    const nombre = v.texto(req.body.nombre, 'El nombre', { max: 100 });
    const username = v.username(req.body.username);
    const correo = v.correoInstitucional(req.body.correo);
    const password = v.password(req.body.password);

    // la BD tiene UNIQUE en correo y username: es la que decide en caso de carrera
    const passwordHash = await bcrypt.hash(password, 10);
    const fotoPerfil = req.file ? `/uploads/${req.file.filename}` : null;

    let resultado;
    try {
        [resultado] = await pool.query(
            'INSERT INTO usuarios (nombre, username, correo, password_hash, foto_perfil) VALUES (?, ?, ?, ?, ?)',
            [nombre, username, correo, passwordHash, fotoPerfil]);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            const campo = /correo/i.test(error.sqlMessage) ? 'El correo ya está registrado' : 'El username ya está en uso';
            throw new ErrorHttp(409, campo);
        }
        throw error;
    }

    res.status(201).json(respuestaSesion(
        { id: resultado.insertId, nombre, username, foto_perfil: fotoPerfil, rol: 'usuario' },
        { mensaje: 'Usuario registrado correctamente' }
    ));
}));

router.post('/login', asyncHandler(async (req, res) => {
    const { correo, password } = req.body;
    const correoNormalizado = typeof correo === 'string' ? correo.trim().toLowerCase() : '';

    const [rows] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [correoNormalizado]);
    const usuario = rows[0];
    const coincide = await bcrypt.compare(typeof password === 'string' ? password : '', usuario ? usuario.password_hash : HASH_FALSO);

    if (!usuario || !coincide) throw new ErrorHttp(401, 'Credenciales incorrectas');

    res.json(respuestaSesion(usuario));
}));

module.exports = router;
