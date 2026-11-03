const { Op } = require('sequelize');
const {
    sequelize, Post, Usuario, Categoria, Comentario, PostLike, PostTag, Tag, Guardado, Seguidor
} = require('../models');
const { agregarLikes, toggleLike } = require('./likes');
const { crearNotificacion, notificarMenciones } = require('./notificaciones');
const { eliminarPost } = require('./contenido');
const { auditar } = require('./auditoria');
const { eliminarImagen } = require('../middleware/upload');
const { ErrorHttp, ignorarDuplicado, reintentarDeadlock } = require('../utils/errores');
const { datosPaginacion } = require('../utils/validar');

const TTL_RANKING_MS = 60 * 1000;
const UNA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
let cacheRanking = { ids: [], hasta: 0 };
let calculoRanking = null;

// Autor y categoria que acompañan a cada post
const INCLUDE_POST = [
    { model: Usuario, as: 'autor', attributes: ['id', 'nombre', 'username', 'foto_perfil'] },
    { model: Categoria, as: 'categoria', attributes: ['id', 'nombre'] }
];
const MAS_RECIENTES = [['fecha_creacion', 'DESC'], ['id', 'DESC']];

// Datos del autor tal como los ve quien consulta. Un post anonimo NUNCA expone al autor real
// en la API; solo el admin recibe ademas `autorReal`.
function autorVisible(anonimo, autor, usuarioActual) {
    if (!anonimo) {
        return {
            usuarioId: autor.id,
            nombreUsuario: autor.nombre,
            usernameUsuario: autor.username,
            fotoPerfilUsuario: autor.foto_perfil || ''
        };
    }
    const visible = { usuarioId: null, nombreUsuario: 'Anónimo', usernameUsuario: '', fotoPerfilUsuario: '' };
    if (usuarioActual && usuarioActual.rol === 'admin') {
        visible.autorReal = { id: autor.id, nombre: autor.nombre, username: autor.username };
    }
    return visible;
}

// Convierte posts (con INCLUDE_POST) en objetos de la API, agregando likes, etiquetas, comentarios
// y guardado con consultas agrupadas (no una por post).
async function serializarPosts(filas, usuarioActual) {
    const posts = filas.map((p) => ({
        id: p.id,
        titulo: p.titulo,
        contenido: p.contenido,
        imagenUrl: p.imagen_url || '',
        fechaCreacion: p.fecha_creacion,
        esAnonimo: Boolean(p.es_anonimo),
        editado: Boolean(p.editado),
        editadoAt: p.editado_at,
        categoriaId: p.categoria.id,
        nombreCategoria: p.categoria.nombre,
        esMio: Boolean(usuarioActual) && usuarioActual.id === p.usuario_id,
        ...autorVisible(p.es_anonimo, p.autor, usuarioActual),
        tags: [],
        totalComentarios: 0,
        guardado: false
    }));
    if (posts.length === 0) return posts;

    await agregarLikes(PostLike, 'post_id', posts, usuarioActual && usuarioActual.id);

    const ids = posts.map((p) => p.id);
    const porId = new Map(posts.map((p) => [p.id, p]));

    const etiquetas = await PostTag.findAll({
        where: { post_id: ids },
        include: [{ model: Tag, as: 'tag', attributes: ['nombre'] }],
        order: [[{ model: Tag, as: 'tag' }, 'nombre', 'ASC']]
    });
    etiquetas.forEach((e) => porId.get(e.post_id).tags.push(e.tag.nombre));

    const comentarios = await Comentario.count({ where: { post_id: ids }, group: ['post_id'] });
    comentarios.forEach((c) => { porId.get(c.post_id).totalComentarios = Number(c.count); });

    if (usuarioActual) {
        const guardados = await Guardado.findAll({ where: { usuario_id: usuarioActual.id, post_id: ids }, attributes: ['post_id'] });
        guardados.forEach((g) => { porId.get(g.post_id).guardado = true; });
    }
    return posts;
}

async function obtenerPost(id, usuarioActual) {
    const post = await Post.findByPk(id, { include: INCLUDE_POST });
    if (!post) throw new ErrorHttp(404, 'Post no encontrado');
    return (await serializarPosts([post], usuarioActual))[0];
}

// Devuelve los posts de `ids` respetando ese orden (los que ya no existan se omiten)
async function postsEnOrden(ids, usuarioActual) {
    if (ids.length === 0) return [];
    const filas = await Post.findAll({ where: { id: ids }, include: INCLUDE_POST });
    filas.sort((x, y) => ids.indexOf(x.id) - ids.indexOf(y.id));
    return serializarPosts(filas, usuarioActual);
}

// Lista paginada de posts con un filtro `where` (feed, perfiles)
async function listarPosts(where, pag, usuarioActual) {
    const total = await Post.count({ where });
    const filas = await Post.findAll({ where, include: INCLUDE_POST, order: MAS_RECIENTES, limit: pag.limit, offset: pag.offset });
    return { posts: await serializarPosts(filas, usuarioActual), paginacion: datosPaginacion(total, pag) };
}

function listarCategorias() {
    return Categoria.findAll({ attributes: ['id', 'nombre', 'descripcion'], order: [['id', 'ASC']], raw: true });
}

// Busqueda: FULLTEXT cuando todas las palabras tienen 3+ letras (minimo del indice InnoDB) y LIKE si no.
// FULLTEXT no existe en el ORM, por eso va como literal (con el valor escapado).
function filtroTexto(q) {
    const palabras = q.split(/\s+/)
        .map((p) => p.replace(/[^\p{L}\p{N}_]/gu, ''))
        .filter(Boolean);
    if (palabras.length === 0) return null;

    if (palabras.every((p) => p.length >= 3)) {
        const busqueda = palabras.map((p) => `+${p}*`).join(' ');
        return sequelize.literal(`MATCH(Post.titulo, Post.contenido) AGAINST (${sequelize.escape(busqueda)} IN BOOLEAN MODE)`);
    }
    const patron = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    return { [Op.or]: [{ titulo: { [Op.like]: patron } }, { contenido: { [Op.like]: patron } }] };
}

// Feed paginado con filtros combinables: { categoria, tag, autor, q, desde, hasta, siguiendo }
// (desde/hasta son textos AAAA-MM-DD ya validados)
async function listarFeed(filtros, pag, usuarioActual) {
    const condiciones = [];

    if (filtros.categoria) condiciones.push({ categoria_id: filtros.categoria });
    if (filtros.tag) {
        condiciones.push(sequelize.literal(`EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
            WHERE pt.post_id = Post.id AND t.nombre = ${sequelize.escape(filtros.tag)})`));
    }
    if (filtros.autor) {
        // los posts anonimos nunca aparecen al filtrar por autor (revelaria quien los escribio)
        const autores = await Usuario.findAll({
            where: { [Op.or]: [{ username: filtros.autor }, { id: Number(filtros.autor) || 0 }] }, attributes: ['id']
        });
        condiciones.push({ es_anonimo: false, usuario_id: autores.map((a) => a.id) });
    }
    if (filtros.q) {
        const texto = filtroTexto(filtros.q);
        if (texto) condiciones.push(texto);
    }
    if (filtros.desde) {
        condiciones.push({ fecha_creacion: { [Op.gte]: new Date(`${filtros.desde}T00:00:00`) } });
    }
    if (filtros.hasta) {
        // hasta el final de ese dia: menor que la medianoche del dia siguiente
        const fin = new Date(`${filtros.hasta}T00:00:00`);
        fin.setDate(fin.getDate() + 1);
        condiciones.push({ fecha_creacion: { [Op.lt]: fin } });
    }
    if (filtros.siguiendo) {
        if (!usuarioActual) throw new ErrorHttp(401, 'Inicia sesión para ver las publicaciones de quienes sigues');
        // sin anonimos: mostrarlos aqui revelaria que la persona seguida los escribio
        const seguidos = await Seguidor.findAll({ where: { seguidor_id: usuarioActual.id }, attributes: ['seguido_id'] });
        condiciones.push({ es_anonimo: false, usuario_id: seguidos.map((s) => s.seguido_id) });
    }

    return listarPosts({ [Op.and]: condiciones }, pag, usuarioActual);
}

// Ranking semanal: posts de los ultimos 7 dias por likes, y comentarios como desempate.
// El orden (solo ids) se guarda 60 s en memoria: es igual para todos y calcularlo es lo mas caro;
// los datos de cada post (likes, guardado, anonimato) se leen frescos.
async function rankingSemanal(limit, usuarioActual) {
    if (Date.now() > cacheRanking.hasta) {
        // si llegan muchas peticiones con la cache vencida, todas esperan un unico calculo
        if (!calculoRanking) {
            calculoRanking = Post.findAll({
                attributes: ['id'],
                where: { fecha_creacion: { [Op.gte]: new Date(Date.now() - UNA_SEMANA_MS) } },
                order: [
                    [sequelize.literal('(SELECT COUNT(*) FROM post_likes l WHERE l.post_id = Post.id)'), 'DESC'],
                    [sequelize.literal('(SELECT COUNT(*) FROM comentarios co WHERE co.post_id = Post.id)'), 'DESC'],
                    ['fecha_creacion', 'DESC']
                ],
                limit: 20
            })
                .then((filas) => {
                    cacheRanking = { ids: filas.map((p) => p.id), hasta: Date.now() + (process.env.NODE_ENV === 'test' ? 0 : TTL_RANKING_MS) };
                })
                .finally(() => { calculoRanking = null; });
        }
        await calculoRanking;
    }
    // los posts borrados desde que se calculo el orden simplemente desaparecen de la lista
    return postsEnOrden(cacheRanking.ids.slice(0, limit), usuarioActual);
}

// Busca o crea las etiquetas (ya normalizadas) y devuelve sus ids.
// UNIQUE(nombre) decide si dos peticiones crean la misma etiqueta a la vez: la perdedora la relee.
async function resolverTags(nombres) {
    const ids = [];
    for (const nombre of nombres) {
        let tag = await Tag.findOne({ where: { nombre } });
        if (!tag) {
            await ignorarDuplicado(() => Tag.create({ nombre }));
            tag = await Tag.findOne({ where: { nombre } });
        }
        if (!ids.includes(tag.id)) ids.push(tag.id);
    }
    return ids;
}

// Ejecuta fn(transaccion) dentro de una transaccion. MySQL puede abortar una de dos transacciones
// concurrentes por deadlock (p. ej. dos posts nuevos con la misma etiqueta); en ese caso se reintenta.
function conTransaccion(fn) {
    return reintentarDeadlock(() => sequelize.transaction(fn), 4);
}

async function validarCategoria(categoriaId) {
    if (!(await Categoria.findByPk(categoriaId))) throw new ErrorHttp(400, 'Categoría no encontrada');
}

function actorDe(usuarioId) {
    return Usuario.findByPk(usuarioId, { attributes: ['id', 'username'] });
}

// datos: { titulo, contenido, categoriaId, tags, esAnonimo, imagenUrl }
async function crearPost(datos, usuario) {
    await validarCategoria(datos.categoriaId);
    const tagIds = await resolverTags(datos.tags);

    const postId = await conTransaccion(async (transaction) => {
        const post = await Post.create({
            titulo: datos.titulo,
            contenido: datos.contenido,
            imagen_url: datos.imagenUrl,
            es_anonimo: datos.esAnonimo,
            usuario_id: usuario.id,
            categoria_id: datos.categoriaId
        }, { transaction });
        for (const tagId of tagIds) {
            await PostTag.create({ post_id: post.id, tag_id: tagId }, { transaction });
        }
        return post.id;
    });

    await notificarMenciones({
        texto: `${datos.titulo}\n${datos.contenido}`,
        actor: datos.esAnonimo ? null : await actorDe(usuario.id),
        postId,
        claveBase: `mencion:post:${postId}`
    });
    return obtenerPost(postId, usuario);
}

// datos: { titulo, contenido, categoriaId?, tags? (null = no cambiar), imagenUrl? (null = no cambiar) }
async function editarPost(id, datos, usuario) {
    const post = await Post.findByPk(id);
    if (!post) throw new ErrorHttp(404, 'Post no encontrado');
    // solo el autor edita
    if (post.usuario_id !== usuario.id) throw new ErrorHttp(403, 'No tienes permiso para editar este post');

    const categoriaId = datos.categoriaId || post.categoria_id;
    await validarCategoria(categoriaId);
    const tagIds = datos.tags ? await resolverTags(datos.tags) : null;
    const imagenAnterior = post.imagen_url;

    await conTransaccion(async (transaction) => {
        await post.update({
            titulo: datos.titulo,
            contenido: datos.contenido,
            categoria_id: categoriaId,
            imagen_url: datos.imagenUrl || imagenAnterior,
            editado: true,
            editado_at: new Date()
        }, { transaction });
        if (tagIds) {
            await PostTag.destroy({ where: { post_id: id }, transaction });
            for (const tagId of tagIds) {
                await PostTag.create({ post_id: id, tag_id: tagId }, { transaction });
            }
        }
    });
    if (datos.imagenUrl && imagenAnterior) eliminarImagen(imagenAnterior);

    await notificarMenciones({
        texto: `${datos.titulo}\n${datos.contenido}`,
        actor: post.es_anonimo ? null : await actorDe(usuario.id),
        postId: id,
        claveBase: `mencion:post:${id}`
    });
    return obtenerPost(id, usuario);
}

// lo borra el autor o un admin (el admin deja auditoria)
async function borrarPost(id, usuario) {
    const post = await Post.findByPk(id, { attributes: ['usuario_id'] });
    if (!post) throw new ErrorHttp(404, 'Post no encontrado');

    const esAutor = post.usuario_id === usuario.id;
    if (!esAutor && usuario.rol !== 'admin') throw new ErrorHttp(403, 'No tienes permiso para eliminar este post');

    await eliminarPost(id);
    if (!esAutor) await auditar(usuario.id, 'eliminar_post', 'post', id, 'Eliminado por un administrador');
}

async function darLike(id, usuario) {
    const post = await Post.findByPk(id, { attributes: ['usuario_id'] });
    if (!post) throw new ErrorHttp(404, 'Post no encontrado');

    const { creado, likes, likedByMe } = await toggleLike(PostLike, 'post_id', id, usuario.id);
    if (creado) {
        const actor = await actorDe(usuario.id);
        await crearNotificacion({
            destinoId: post.usuario_id,
            actorId: usuario.id,
            tipo: 'like',
            mensaje: `@${actor.username} le dio like a tu publicación`,
            referenciaId: id,
            clave: `like:post:${id}:u${usuario.id}`
        });
    }
    return { likes, likedByMe };
}

// Guarda o quita de guardados; devuelve true si quedo guardado
async function alternarGuardado(id, usuario) {
    if (!(await Post.findByPk(id, { attributes: ['id'] }))) throw new ErrorHttp(404, 'Post no encontrado');

    const fila = { usuario_id: usuario.id, post_id: id };
    let guardado = false;
    await reintentarDeadlock(async () => {
        const borrados = await Guardado.destroy({ where: fila });
        guardado = false;
        if (borrados === 0) {
            // si dos clicks llegan a la vez, la PK compuesta deja un solo registro
            await ignorarDuplicado(() => Guardado.create(fila));
            guardado = true;
        }
    });
    return guardado;
}

// Publicaciones guardadas: lista privada, solo el dueño la ve
async function listarGuardados(usuario, pag) {
    const total = await Guardado.count({ where: { usuario_id: usuario.id } });
    const guardados = await Guardado.findAll({
        where: { usuario_id: usuario.id },
        order: [['fecha', 'DESC'], ['post_id', 'DESC']],
        limit: pag.limit,
        offset: pag.offset
    });
    return {
        posts: await postsEnOrden(guardados.map((g) => g.post_id), usuario),
        paginacion: datosPaginacion(total, pag)
    };
}

module.exports = {
    autorVisible, serializarPosts, obtenerPost, listarPosts, listarCategorias, listarFeed, rankingSemanal,
    crearPost, editarPost, borrarPost, darLike, alternarGuardado, listarGuardados
};
