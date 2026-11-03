const { Op } = require('sequelize');
const { Post, Comentario } = require('../models');
const { eliminarImagen } = require('../middleware/upload');

// Borra un post (la BD borra en cascada comentarios, likes, guardados y etiquetas; los reportes se
// conservan) y despues limpia del disco las imagenes del post y de sus comentarios.
async function eliminarPost(postId) {
    const post = await Post.findByPk(postId, { attributes: ['imagen_url'] });
    const comentarios = await Comentario.findAll({ where: { post_id: postId }, attributes: ['imagen_url'] });
    await Post.destroy({ where: { id: postId } });
    [post, ...comentarios].forEach((i) => i && eliminarImagen(i.imagen_url));
}

// Borra un comentario y sus respuestas (cascada)
async function eliminarComentario(comentarioId) {
    const comentarios = await Comentario.findAll({
        where: { [Op.or]: [{ id: comentarioId }, { comentario_padre_id: comentarioId }] },
        attributes: ['imagen_url']
    });
    await Comentario.destroy({ where: { id: comentarioId } });
    comentarios.forEach((c) => eliminarImagen(c.imagen_url));
}

module.exports = { eliminarPost, eliminarComentario };
