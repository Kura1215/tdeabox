const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { generarToken } = require('../config/jwt');

const router = express.Router();

router.post('/register', async (req, res) => {
    const { nombre, username, correo, password } = req.body;

    try {
        const [correoExiste] = await pool.query('SELECT id FROM usuarios WHERE correo = ?', [correo]);
        if (correoExiste.length > 0) {
            return res.status(400).json({ error: 'El correo ya está registrado' });
        }

        const [usernameExiste] = await pool.query('SELECT id FROM usuarios WHERE username = ?', [username]);
        if (usernameExiste.length > 0) {
            return res.status(400).json({ error: 'El username ya está en uso' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await pool.query(
            'INSERT INTO usuarios (nombre, username, correo, password_hash) VALUES (?, ?, ?, ?)',
            [nombre, username, correo, passwordHash]
        );

        res.json({ mensaje: 'Usuario registrado correctamente' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/login', async (req, res) => {
    const { correo, password } = req.body;

    try {
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
        if (rows.length === 0) {
            throw new Error('Usuario no encontrado');
        }

        const usuario = rows[0];
        const coincide = await bcrypt.compare(password, usuario.password_hash);
        if (!coincide) {
            throw new Error('Contraseña incorrecta');
        }

        const token = generarToken(usuario.correo);

        res.json({
            token,
            usuarioId: usuario.id,
            nombre: usuario.nombre,
            username: usuario.username,
            fotoPerfil: usuario.foto_perfil || ''
        });
    } catch (error) {
        res.status(401).json({ error: 'Credenciales incorrectas' });
    }
});

module.exports = router;
