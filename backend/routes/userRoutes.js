const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { upload, eliminarImagen } = require('../middleware/upload');
const { agregarLikes } = require('../utils/likes');

const router = express.Router();

// posts de un usuario con la misma forma que usa el feed, mas sus likes
async function postsDeUsuario(u, correoActual) {
    const [rows] = await pool.query(`
        SELECT p.id, p.titulo, p.contenido, p.imagen_url, p.fecha_creacion,
               c.id AS categoria_id, c.nombre AS nombre_categoria
        FROM posts p
        JOIN categorias c ON c.id = p.categoria_id
        WHERE p.usuario_id = ?
        ORDER BY p.fecha_creacion DESC
    `, [u.id]);

    const posts = rows.map((p) => ({
        id: p.id,
        titulo: p.titulo,
        contenido: p.contenido,
        imagenUrl: p.imagen_url || '',
        fechaCreacion: p.fecha_creacion,
        usuarioId: u.id,
        nombreUsuario: u.nombre,
        usernameUsuario: u.username,
        fotoPerfilUsuario: u.foto_perfil || '',
        categoriaId: p.categoria_id,
        nombreCategoria: p.nombre_categoria
    }));

    return agregarLikes('post_likes', 'post_id', posts, correoActual);
}

router.get('/me', requireAuth, async (req, res) => {
    try {
        const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [req.correo]);
        if (usuarios.length === 0) throw new Error('Usuario no encontrado');
        const u = usuarios[0];

        const posts = await postsDeUsuario(u, req.correo);

        res.json({
            id: u.id,
            nombre: u.nombre,
            username: u.username,
            correo: u.correo,
            fotoPerfil: u.foto_perfil || '',
            fechaRegistro: u.fecha_registro,
            posts
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

// perfil publico de otro usuario (sin correo)
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [req.params.id]);
        if (usuarios.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        const u = usuarios[0];

        res.json({
            id: u.id,
            nombre: u.nombre,
            username: u.username,
            fotoPerfil: u.foto_perfil || '',
            fechaRegistro: u.fecha_registro,
            posts: await postsDeUsuario(u, req.correo)
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
