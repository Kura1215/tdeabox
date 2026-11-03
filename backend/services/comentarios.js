const { Comentario, ComentarioLike, Post, Usuario } = require('../models');
const { agregarLikes, toggleLike } = require('./likes');
const { crearNotificacion, notificarMenciones } = require('./notificaciones');
const { eliminarComentario } = require('./contenido');
const { auditar } = require('./auditoria');
const { autorVisible } = require('./posts');
const { ErrorHttp } = require('../utils/errores');
const { datosPaginacion } = require('../utils/validar');

const INCLUDE_AUTOR = [{ model: Usuario, as: 'autor', attributes: ['id', 'nombre', 'username', 'foto_perfil'] }];
const MAS_ANTIGUOS = [['fecha_creacion', 'ASC'], ['id', 'ASC']];

// Si el autor de un post anonimo comenta en su propio post, su comentario tambien se oculta
// (si no, el username lo delataria).
function serializarComentario(c, post, usuarioActual) {
    const oculto = Boolean(post.es_anonimo) && c.usuario_id === post.usuario_id;
    return {
        id: c.id,
        contenido: c.contenido,
        imagenUrl: c.imagen_url || '',
        editado: Boolean(c.editado),
        fechaCreacion: c.fecha_creacion,
        postId: c.post_id,
        comentarioPadreId: c.comentario_padre_id,
        esMio: Boolean(usuarioActual) && usuarioActual.id === c.usuario_id,
        ...autorVisible(oculto, c.autor, usuarioActual),
        likes: 0,
        likedByMe: false
    };
}

async function buscarPost(id) {
    const post = await Post.findByPk(id, { attributes: ['id', 'usuario_id', 'es_anonimo'] });
    if (!post) throw new ErrorHttp(404, 'Post no encontrado');
    return post;
}

async function buscarComentario(id) {
    const comentario = await Comentario.findByPk(id);
    if (!comentario) throw new ErrorHttp(404, 'Comentario no encontrado');
    return comentario;
}

// Comentarios raiz paginados, cada uno con sus respuestas (un solo nivel)
async function listarComentarios(postId, usuarioActual, pag) {
    const post = await buscarPost(postId);
    const raiz = { post_id: postId, comentario_padre_id: null };

    const total = await Comentario.count({ where: raiz });
    const raices = await Comentario.findAll({
        where: raiz, include: INCLUDE_AUTOR, order: MAS_ANTIGUOS, limit: pag.limit, offset: pag.offset
    });
    const respuestas = raices.length === 0 ? [] : await Comentario.findAll({
        where: { comentario_padre_id: raices.map((r) => r.id) }, include: INCLUDE_AUTOR, order: MAS_ANTIGUOS
    });

    const comentarios = raices.map((r) => ({ ...serializarComentario(r, post, usuarioActual), respuestas: [] }));
    const porId = new Map(comentarios.map((c) => [c.id, c]));
    respuestas.forEach((r) => porId.get(r.comentario_padre_id).respuestas.push(serializarComentario(r, post, usuarioActual)));

    const todos = comentarios.flatMap((c) => [c, ...c.respuestas]);
    await agregarLikes(ComentarioLike, 'comentario_id', todos, usuarioActual && usuarioActual.id);

    return { comentarios, paginacion: datosPaginacion(total, pag) };
}

// Crea un comentario; si hay padreId, es una respuesta (maximo un nivel). postId puede ser null
// cuando se responde desde /comentarios/:id/respuestas (se usa el post del padre).
async function crearComentario({ postId, padreId, contenido, imagenUrl }, usuario) {
    const padre = padreId ? await buscarComentario(padreId) : null;
    const post = await buscarPost(postId || padre.post_id);

    if (padre) {
        if (padre.comentario_padre_id !== null) throw new ErrorHttp(400, 'No se puede responder a una respuesta');
        if (padre.post_id !== post.id) throw new ErrorHttp(400, 'El comentario padre es de otro post');
    }

    const nuevo = await Comentario.create({
        contenido,
        imagen_url: imagenUrl,
        usuario_id: usuario.id,
        post_id: post.id,
        comentario_padre_id: padre ? padre.id : null
    });
    const id = nuevo.id;

    const actor = await Usuario.findByPk(usuario.id, { attributes: ['id', 'username'] });
    const ocultarAutor = Boolean(post.es_anonimo) && usuario.id === post.usuario_id;

    await crearNotificacion({
        destinoId: post.usuario_id,
        actorId: usuario.id,
        tipo: 'comentario',
        mensaje: `@${actor.username} comentó tu publicación`,
        referenciaId: post.id,
        clave: `comentario:${id}:post`
    });
    if (padre && padre.usuario_id !== post.usuario_id) {
        await crearNotificacion({
            destinoId: padre.usuario_id,
            actorId: usuario.id,
            tipo: 'comentario',
            mensaje: `@${actor.username} respondió tu comentario`,
            referenciaId: post.id,
            clave: `comentario:${id}:respuesta`
        });
    }
    await notificarMenciones({
        texto: contenido,
        actor: ocultarAutor ? null : actor,
        postId: post.id,
        claveBase: `mencion:comentario:${id}`
    });

    const creado = await Comentario.findByPk(id, { include: INCLUDE_AUTOR });
    const comentario = serializarComentario(creado, post, usuario);
    if (!padre) comentario.respuestas = [];
    return comentario;
}

async function editarComentario(id, contenido, usuario) {
    const comentario = await buscarComentario(id);
    if (comentario.usuario_id !== usuario.id) throw new ErrorHttp(403, 'No tienes permiso para editar este comentario');

    await comentario.update({ contenido, editado: true });

    const actualizado = await Comentario.findByPk(id, { include: INCLUDE_AUTOR });
    return serializarComentario(actualizado, await buscarPost(actualizado.post_id), usuario);
}

async function darLike(id, usuario) {
    const comentario = await buscarComentario(id);

    const { creado, likes, likedByMe } = await toggleLike(ComentarioLike, 'comentario_id', id, usuario.id);
    if (creado) {
        const actor = await Usuario.findByPk(usuario.id, { attributes: ['username'] });
        await crearNotificacion({
            destinoId: comentario.usuario_id,
            actorId: usuario.id,
            tipo: 'like',
            mensaje: `@${actor.username} le dio like a tu comentario`,
            referenciaId: comentario.post_id,
            clave: `like:comentario:${id}:u${usuario.id}`
        });
    }
    return { likes, likedByMe };
}

// lo borra el autor o un admin (el admin deja auditoria)
async function borrarComentario(id, usuario) {
    const comentario = await buscarComentario(id);

    const esAutor = comentario.usuario_id === usuario.id;
    if (!esAutor && usuario.rol !== 'admin') throw new ErrorHttp(403, 'No tienes permiso para eliminar este comentario');

    await eliminarComentario(id);
    if (!esAutor) await auditar(usuario.id, 'eliminar_comentario', 'comentario', id, 'Eliminado por un administrador');
}

module.exports = { listarComentarios, crearComentario, editarComentario, darLike, borrarComentario };
