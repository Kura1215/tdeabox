const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { upload, eliminarImagen } = require('../middleware/upload');
const { agregarLikes, toggleLike } = require('../utils/likes');

const router = express.Router();

const SELECT_POST = `
    SELECT p.id, p.titulo, p.contenido, p.imagen_url, p.fecha_creacion,
           u.id AS usuario_id, u.nombre AS nombre_usuario, u.username AS username_usuario, u.foto_perfil AS foto_usuario,
           c.id AS categoria_id, c.nombre AS nombre_categoria
    FROM posts p
    JOIN usuarios u ON u.id = p.usuario_id
    JOIN categorias c ON c.id = p.categoria_id
`;

function mapearPost(row) {
    return {
        id: row.id,
        titulo: row.titulo,
        contenido: row.contenido,
        imagenUrl: row.imagen_url || '',
        fechaCreacion: row.fecha_creacion,
        usuarioId: row.usuario_id,
        nombreUsuario: row.nombre_usuario,
        usernameUsuario: row.username_usuario,
        fotoPerfilUsuario: row.foto_usuario || '',
        categoriaId: row.categoria_id,
        nombreCategoria: row.nombre_categoria
    };
}

function mapearComentario(row) {
    return {
        id: row.id,
        contenido: row.contenido,
        imagenUrl: row.imagen_url || '',
        fechaCreacion: row.fecha_creacion,
        usuarioId: row.usuario_id,
        nombreUsuario: row.nombre_usuario,
        usernameUsuario: row.username_usuario,
        fotoPerfilUsuario: row.foto_usuario || ''
    };
}

router.get('/categorias', async (req, res) => {
    const [rows] = await pool.query('SELECT id, nombre, descripcion FROM categorias');
    res.json(rows);
});

router.get('/posts', requireAuth.opcional, async (req, res) => {
    const { categoria, buscar } = req.query;

    const filtros = [];
    const params = [];

    if (categoria) {
        filtros.push('p.categoria_id = ?');
        params.push(categoria);
    }
    if (buscar && buscar.trim() !== '') {
        filtros.push('p.titulo LIKE ?');
        params.push(`%${buscar.trim()}%`);
    }

    let sql = SELECT_POST;
    if (filtros.length > 0) sql += ' WHERE ' + filtros.join(' AND ');
    sql += ' ORDER BY p.fecha_creacion DESC';

    const [rows] = await pool.query(sql, params);
    const posts = rows.map(mapearPost);
    await agregarLikes('post_likes', 'post_id', posts, req.correo);
    res.json(posts);
});

router.get('/posts/:id', requireAuth.opcional, async (req, res) => {
    const { id } = req.params;

    const [rows] = await pool.query(`${SELECT_POST} WHERE p.id = ?`, [id]);
    if (rows.length === 0) {
        return res.status(404).json({ error: 'Post no encontrado' });
    }

    const post = mapearPost(rows[0]);

    const [comentarios] = await pool.query(`
        SELECT co.id, co.contenido, co.imagen_url, co.fecha_creacion,
               u.id AS usuario_id, u.nombre AS nombre_usuario, u.username AS username_usuario, u.foto_perfil AS foto_usuario
        FROM comentarios co
        JOIN usuarios u ON u.id = co.usuario_id
        WHERE co.post_id = ?
        ORDER BY co.fecha_creacion ASC
    `, [id]);

    post.comentarios = comentarios.map(mapearComentario);
    await agregarLikes('post_likes', 'post_id', [post], req.correo);
    await agregarLikes('comentario_likes', 'comentario_id', post.comentarios, req.correo);
    res.json(post);
});

router.post('/posts/:id/like', requireAuth, async (req, res) => {
    try {
        const [posts] = await pool.query('SELECT id FROM posts WHERE id = ?', [req.params.id]);
        if (posts.length === 0) return res.status(404).json({ error: 'Post no encontrado' });

        res.json(await toggleLike('post_likes', 'post_id', req.params.id, req.correo));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/posts', requireAuth, upload.single('imagen'), async (req, res) => {
    const { titulo, contenido, categoriaId } = req.body;

    try {
        const [usuarios] = await pool.query('SELECT id FROM usuarios WHERE correo = ?', [req.correo]);
        if (usuarios.length === 0) throw new Error('Usuario no encontrado');

        const [categorias] = await pool.query('SELECT id FROM categorias WHERE id = ?', [categoriaId]);
        if (categorias.length === 0) throw new Error('Categoría no encontrada');

        const imagenUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const [resultado] = await pool.query(
            'INSERT INTO posts (titulo, contenido, imagen_url, usuario_id, categoria_id) VALUES (?, ?, ?, ?, ?)',
            [titulo, contenido, imagenUrl, usuarios[0].id, categoriaId]
        );

        const [rows] = await pool.query(`${SELECT_POST} WHERE p.id = ?`, [resultado.insertId]);
        const nuevo = mapearPost(rows[0]);
        await agregarLikes('post_likes', 'post_id', [nuevo], req.correo);
        res.json(nuevo);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.put('/posts/:id', requireAuth, upload.single('imagen'), async (req, res) => {
    const { id } = req.params;
    const { titulo, contenido } = req.body;

    try {
        const [rows] = await pool.query(`
            SELECT p.*, u.correo AS autor_correo FROM posts p
            JOIN usuarios u ON u.id = p.usuario_id WHERE p.id = ?
        `, [id]);

        if (rows.length === 0) throw new Error('Post no encontrado');
        const post = rows[0];

        if (post.autor_correo !== req.correo) {
            throw new Error('No tienes permiso para editar este post');
        }

        let imagenUrl = post.imagen_url;
        if (req.file) {
            if (imagenUrl) eliminarImagen(imagenUrl);
            imagenUrl = `/uploads/${req.file.filename}`;
        }

        await pool.query(
            'UPDATE posts SET titulo = ?, contenido = ?, imagen_url = ? WHERE id = ?',
            [titulo, contenido, imagenUrl, id]
        );

        const [actualizado] = await pool.query(`${SELECT_POST} WHERE p.id = ?`, [id]);
        res.json(mapearPost(actualizado[0]));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/posts/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await pool.query(`
            SELECT p.*, u.correo AS autor_correo FROM posts p
            JOIN usuarios u ON u.id = p.usuario_id WHERE p.id = ?
        `, [id]);

        if (rows.length === 0) throw new Error('Post no encontrado');
        const post = rows[0];

        if (post.autor_correo !== req.correo) {
            throw new Error('No tienes permiso para eliminar este post');
        }

        if (post.imagen_url) eliminarImagen(post.imagen_url);

        await pool.query('DELETE FROM posts WHERE id = ?', [id]);
        res.json({ mensaje: 'Post eliminado' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
