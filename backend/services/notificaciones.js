const { Notificacion, Usuario } = require('../models');
const { ErrorHttp, ignorarDuplicado } = require('../utils/errores');
const { datosPaginacion } = require('../utils/validar');

const REGEX_MENCION = /(?<![\w@])@([a-zA-Z0-9_]{3,30})/g;

// Punto unico para crear notificaciones (RF07).
// - no notifica al propio actor (comentar/likear lo tuyo)
// - `clave` identifica el evento; UNIQUE(usuario_id, clave) evita repetir (like, quitar, like)
// Devuelve true si se creo.
async function crearNotificacion({ destinoId, actorId = null, tipo, mensaje, referenciaId = null, clave }) {
    if (!destinoId || (actorId && destinoId === actorId)) return false;

    return ignorarDuplicado(async () => {
        await Notificacion.create({
            usuario_id: destinoId,
            actor_id: actorId,
            tipo,
            mensaje: String(mensaje).slice(0, 150),
            referencia_id: referenciaId,
            clave
        });
        return true;
    }, false);
}

function extraerMenciones(texto) {
    const usernames = new Set();
    for (const m of String(texto || '').matchAll(REGEX_MENCION)) {
        usernames.add(m[1].toLowerCase());
        if (usernames.size >= 10) break; // tope para que un post no dispare decenas de avisos
    }
    return [...usernames];
}

// Notifica a los usuarios mencionados con @username (RF12).
// actor = { id, username } o null si el autor debe quedar oculto (publicacion anonima).
async function notificarMenciones({ texto, actor, postId, claveBase }) {
    const usernames = extraerMenciones(texto);
    if (usernames.length === 0) return;

    const usuarios = await Usuario.findAll({ where: { username: usernames }, attributes: ['id'] });
    const mensaje = actor
        ? `@${actor.username} te mencionó en una publicación`
        : 'Alguien te mencionó en una publicación anónima';

    for (const u of usuarios) {
        await crearNotificacion({
            destinoId: u.id,
            actorId: actor ? actor.id : null,
            tipo: 'mencion',
            mensaje,
            referenciaId: postId,
            clave: claveBase
        });
    }
}

async function listarNotificaciones(usuarioId, soloNoLeidas, pag) {
    const where = soloNoLeidas ? { usuario_id: usuarioId, leido: false } : { usuario_id: usuarioId };
    const total = await Notificacion.count({ where });
    const noLeidas = await Notificacion.count({ where: { usuario_id: usuarioId, leido: false } });
    const filas = await Notificacion.findAll({
        where, order: [['fecha', 'DESC'], ['id', 'DESC']], limit: pag.limit, offset: pag.offset
    });

    return {
        notificaciones: filas.map((n) => ({
            id: n.id, tipo: n.tipo, mensaje: n.mensaje, referenciaId: n.referencia_id,
            leido: Boolean(n.leido), fecha: n.fecha
        })),
        noLeidas,
        paginacion: datosPaginacion(total, pag)
    };
}

async function marcarTodasLeidas(usuarioId) {
    await Notificacion.update({ leido: true }, { where: { usuario_id: usuarioId } });
}

// solo se pueden marcar las notificaciones propias
async function marcarNotificacion(id, usuarioId, leido) {
    const notificacion = await Notificacion.findOne({ where: { id, usuario_id: usuarioId } });
    if (!notificacion) throw new ErrorHttp(404, 'Notificación no encontrada');
    await notificacion.update({ leido });
}

module.exports = {
    crearNotificacion, notificarMenciones, extraerMenciones, listarNotificaciones, marcarTodasLeidas, marcarNotificacion
};
