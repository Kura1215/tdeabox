const pool = require('../db');
const { eliminarImagen } = require('../middleware/upload');

// Borra un post (la BD borra en cascada comentarios, likes, guardados y etiquetas; los reportes se
// conservan) y despues limpia del disco las imagenes del post y de sus comentarios.
async function eliminarPost(postId) {
    const [imagenes] = await pool.query(
        `SELECT imagen_url FROM posts WHERE id = ?
         UNION ALL SELECT imagen_url FROM comentarios WHERE post_id = ?`, [postId, postId]);
    await pool.query('DELETE FROM posts WHERE id = ?', [postId]);
    imagenes.forEach((i) => eliminarImagen(i.imagen_url));
}

// Borra un comentario y sus respuestas (cascada)
async function eliminarComentario(comentarioId) {
    const [imagenes] = await pool.query(
        `SELECT imagen_url FROM comentarios WHERE id = ?
         UNION ALL SELECT imagen_url FROM comentarios WHERE comentario_padre_id = ?`, [comentarioId, comentarioId]);
    await pool.query('DELETE FROM comentarios WHERE id = ?', [comentarioId]);
    imagenes.forEach((i) => eliminarImagen(i.imagen_url));
}

module.exports = { eliminarPost, eliminarComentario };
