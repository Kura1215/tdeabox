const { Usuario, Post, Comentario, PostLike, Seguidor } = require('../models');
const { listarPosts } = require('./posts');
const { crearNotificacion } = require('./notificaciones');
const { eliminarImagen } = require('../middleware/upload');
const { ErrorHttp, ignorarDuplicado, reintentarDeadlock } = require('../utils/errores');
const { datosPaginacion } = require('../utils/validar');

const LIKES_POPULAR = 10;
const COMENTARIOS_ACTIVO = 10;

async function buscarUsuario(id) {
    const usuario = await Usuario.findByPk(id);
    if (!usuario) throw new ErrorHttp(404, 'Usuario no encontrado');
    return usuario;
}

// En la vista publica solo cuentan los posts no anonimos (para no revelar que alguien escribio uno)
function filtroPosts(usuarioId, publico) {
    return publico ? { usuario_id: usuarioId, es_anonimo: false } : { usuario_id: usuarioId };
}

// Estadisticas e insignias (RF12)
async function estadisticas(usuarioId, publico) {
    const posts = await Post.count({ where: filtroPosts(usuarioId, publico) });
    const comentarios = await Comentario.count({ where: { usuario_id: usuarioId } });
    const likesRecibidos = await PostLike.count({
        include: [{ model: Post, as: 'post', attributes: [], where: filtroPosts(usuarioId, publico) }]
    });
    const seguidores = await Seguidor.count({ where: { seguido_id: usuarioId } });
    const seguidos = await Seguidor.count({ where: { seguidor_id: usuarioId } });
    // likes de cada post publico del usuario, para la insignia Popular
    const likesPorPost = await PostLike.count({
        include: [{ model: Post, as: 'post', attributes: [], where: filtroPosts(usuarioId, true) }],
        group: ['PostLike.post_id']
    });

    const insignias = [];
    if (likesPorPost.some((p) => Number(p.count) >= LIKES_POPULAR)) insignias.push('Popular');
    if (comentarios >= COMENTARIOS_ACTIVO) insignias.push('Activo');

    return { estadisticas: { posts, comentarios, likesRecibidos }, seguidores, seguidos, insignias };
}

function perfilBase(u) {
    return {
        id: u.id,
        nombre: u.nombre,
        username: u.username,
        fotoPerfil: u.foto_perfil || '',
        biografia: u.biografia || '',
        programaAcademico: u.programa_academico || '',
        rol: u.rol,
        fechaRegistro: u.fecha_registro
    };
}

// Datos ligeros de la sesion (nombre, foto y rol actuales)
async function datosSesion(usuarioId) {
    const u = await buscarUsuario(usuarioId);
    return { usuarioId: u.id, nombre: u.nombre, username: u.username, fotoPerfil: u.foto_perfil || '', rol: u.rol };
}

// Perfil propio: con correo y con los posts anonimos incluidos
async function perfilPropio(usuarioActual, pag) {
    const u = await buscarUsuario(usuarioActual.id);
    const { posts, paginacion } = await listarPosts(filtroPosts(u.id, false), pag, usuarioActual);
    return { ...perfilBase(u), correo: u.correo, ...(await estadisticas(u.id, false)), posts, paginacion };
}

// datos: { nombre, biografia, programaAcademico, fotoPerfil } (undefined = no cambiar)
async function editarPerfil(usuarioId, datos) {
    const u = await buscarUsuario(usuarioId);
    const fotoAnterior = u.foto_perfil;

    await u.update({
        nombre: datos.nombre !== undefined ? datos.nombre : u.nombre,
        biografia: datos.biografia !== undefined ? datos.biografia : u.biografia,
        programa_academico: datos.programaAcademico !== undefined ? datos.programaAcademico : u.programa_academico,
        foto_perfil: datos.fotoPerfil || fotoAnterior
    });
    if (datos.fotoPerfil && fotoAnterior) eliminarImagen(fotoAnterior);

    return { ...perfilBase(u), correo: u.correo };
}

// Perfil publico de otro usuario: sin correo y sin posts anonimos
async function perfilPublico(id, usuarioActual, pag) {
    const u = await buscarUsuario(id);
    const sigo = await Seguidor.count({ where: { seguidor_id: usuarioActual.id, seguido_id: id } });
    const { posts, paginacion } = await listarPosts(filtroPosts(id, true), pag, usuarioActual);
    return {
        ...perfilBase(u),
        ...(await estadisticas(id, true)),
        siguiendo: sigo > 0,
        esMio: id === usuarioActual.id,
        posts,
        paginacion
    };
}

// Sigue o deja de seguir; devuelve { siguiendo, seguidores }
async function alternarSeguir(id, usuarioActual) {
    if (id === usuarioActual.id) throw new ErrorHttp(400, 'No puedes seguirte a ti mismo');
    await buscarUsuario(id);

    const fila = { seguidor_id: usuarioActual.id, seguido_id: id };
    let siguiendo = false;
    let creado = false;
    await reintentarDeadlock(async () => {
        const borrados = await Seguidor.destroy({ where: fila });
        siguiendo = false;
        creado = false;
        if (borrados === 0) {
            // PK compuesta: si dos peticiones llegan a la vez, solo una inserta y la otra queda como "ya sigue"
            siguiendo = true;
            creado = await ignorarDuplicado(async () => {
                await Seguidor.create(fila);
                return true;
            }, false);
        }
    });

    if (creado) {
        const actor = await Usuario.findByPk(usuarioActual.id, { attributes: ['username'] });
        await crearNotificacion({
            destinoId: id,
            actorId: usuarioActual.id,
            tipo: 'seguidor',
            mensaje: `@${actor.username} empezó a seguirte`,
            referenciaId: usuarioActual.id,
            clave: `seguidor:u${usuarioActual.id}`
        });
    }

    const seguidores = await Seguidor.count({ where: { seguido_id: id } });
    return { siguiendo, seguidores };
}

// tipo 'seguidores' (quienes siguen a id) o 'seguidos' (a quienes sigue id)
async function listarRelacion(id, tipo, pag) {
    await buscarUsuario(id);
    const where = tipo === 'seguidores' ? { seguido_id: id } : { seguidor_id: id };
    const alias = tipo === 'seguidores' ? 'usuarioSeguidor' : 'usuarioSeguido';

    const total = await Seguidor.count({ where });
    const filas = await Seguidor.findAll({
        where,
        include: [{ model: Usuario, as: alias, attributes: ['id', 'nombre', 'username', 'foto_perfil'] }],
        order: [['fecha', 'DESC']],
        limit: pag.limit,
        offset: pag.offset
    });

    return {
        usuarios: filas.map((f) => {
            const u = f[alias];
            return { id: u.id, nombre: u.nombre, username: u.username, fotoPerfil: u.foto_perfil || '' };
        }),
        paginacion: datosPaginacion(total, pag)
    };
}

module.exports = { datosSesion, perfilPropio, editarPerfil, perfilPublico, alternarSeguir, listarRelacion };
