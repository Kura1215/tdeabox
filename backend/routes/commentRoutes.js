const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { upload, eliminarImagen } = require('../middleware/upload');

const router = express.Router();

router.post('/posts/:id/comentarios', requireAuth, upload.single('imagen'), async (req, res) => {
    const { id } = req.params;
    const { contenido } = req.body;

    try {
        const [usuarios] = await pool.query('SELECT id FROM usuarios WHERE correo = ?', [req.correo]);
        if (usuarios.length === 0) throw new Error('Usuario no encontrado');

        const [posts] = await pool.query('SELECT id FROM posts WHERE id = ?', [id]);
        if (posts.length === 0) throw new Error('Post no encontrado');

        const imagenUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const [resultado] = await pool.query(
            'INSERT INTO comentarios (contenido, imagen_url, usuario_id, post_id) VALUES (?, ?, ?, ?)',
            [contenido, imagenUrl, usuarios[0].id, id]
        );

        const [rows] = await pool.query(`
            SELECT co.id, co.contenido, co.imagen_url, co.fecha_creacion, co.post_id,
                   u.id AS usuario_id, u.nombre AS nombre_usuario, u.username AS username_usuario, u.foto_perfil AS foto_usuario
            FROM comentarios co
            JOIN usuarios u ON u.id = co.usuario_id
            WHERE co.id = ?
        `, [resultado.insertId]);

        const c = rows[0];
        res.json({
            id: c.id,
            contenido: c.contenido,
            imagenUrl: c.imagen_url || '',
            fechaCreacion: c.fecha_creacion,
            postId: c.post_id,
            usuarioId: c.usuario_id,
            nombreUsuario: c.nombre_usuario,
            usernameUsuario: c.username_usuario,
            fotoPerfilUsuario: c.foto_usuario || ''
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/comentarios/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await pool.query(`
            SELECT co.*, u.correo AS autor_correo FROM comentarios co
            JOIN usuarios u ON u.id = co.usuario_id WHERE co.id = ?
        `, [id]);

        if (rows.length === 0) throw new Error('Comentario no encontrado');
        const comentario = rows[0];

        if (comentario.autor_correo !== req.correo) {
            throw new Error('No tienes permiso para eliminar este comentario');
        }

        if (comentario.imagen_url) eliminarImagen(comentario.imagen_url);

        await pool.query('DELETE FROM comentarios WHERE id = ?', [id]);
        res.json({ mensaje: 'Comentario eliminado correctamente' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
