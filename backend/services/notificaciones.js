const pool = require('../db');
const { ignorarDuplicado } = require('../utils/errores');

const REGEX_MENCION = /(?<![\w@])@([a-zA-Z0-9_]{3,30})/g;

// Punto unico para crear notificaciones (RF07).
// - no notifica al propio actor (comentar/likear lo tuyo)
// - `clave` identifica el evento; UNIQUE(usuario_id, clave) evita repetir (like, quitar, like)
// Devuelve true si se creo.
async function crearNotificacion({ destinoId, actorId = null, tipo, mensaje, referenciaId = null, clave }) {
    if (!destinoId || (actorId && destinoId === actorId)) return false;

    return ignorarDuplicado(async () => {
        await pool.query(
            `INSERT INTO notificaciones (usuario_id, actor_id, tipo, mensaje, referencia_id, clave)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [destinoId, actorId, tipo, String(mensaje).slice(0, 150), referenciaId, clave]
        );
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

    const [usuarios] = await pool.query('SELECT id FROM usuarios WHERE username IN (?)', [usernames]);
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

module.exports = { crearNotificacion, notificarMenciones, extraerMenciones };
