const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { upload, eliminarImagen } = require('../middleware/upload');

const router = express.Router();

router.get('/me', requireAuth, async (req, res) => {
    try {
        const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [req.correo]);
        if (usuarios.length === 0) throw new Error('Usuario no encontrado');
        const u = usuarios[0];

        const [posts] = await pool.query(`
            SELECT p.id, p.titulo, p.contenido, p.imagen_url, p.fecha_creacion,
                   c.id AS categoria_id, c.nombre AS nombre_categoria
            FROM posts p
            JOIN categorias c ON c.id = p.categoria_id
            WHERE p.usuario_id = ?
            ORDER BY p.fecha_creacion DESC
        `, [u.id]);

        res.json({
            id: u.id,
            nombre: u.nombre,
            username: u.username,
            correo: u.correo,
            fotoPerfil: u.foto_perfil || '',
            fechaRegistro: u.fecha_registro,
            posts: posts.map((p) => ({
                id: p.id,
                titulo: p.titulo,
                contenido: p.contenido,
                imagenUrl: p.imagen_url || '',
                fechaCreacion: p.fecha_creacion,
                categoriaId: p.categoria_id,
                nombreCategoria: p.nombre_categoria
            }))
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.put('/me', requireAuth, upload.single('foto'), async (req, res) => {
    const { nombre } = req.body;

    try {
        const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [req.correo]);
        if (usuarios.length === 0) throw new Error('Usuario no encontrado');
        const u = usuarios[0];

        const nuevoNombre = nombre && nombre.trim() !== '' ? nombre.trim() : u.nombre;

        let fotoPerfil = u.foto_perfil;
        if (req.file) {
            if (fotoPerfil) eliminarImagen(fotoPerfil);
            fotoPerfil = `/uploads/${req.file.filename}`;
        }

        await pool.query('UPDATE usuarios SET nombre = ?, foto_perfil = ? WHERE id = ?', [nuevoNombre, fotoPerfil, u.id]);

        res.json({
            id: u.id,
            nombre: nuevoNombre,
            username: u.username,
            correo: u.correo,
            fotoPerfil: fotoPerfil || '',
            fechaRegistro: u.fecha_registro
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
