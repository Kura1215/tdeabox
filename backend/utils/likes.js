const pool = require('../db');
const { ignorarDuplicado, reintentarDeadlock } = require('./errores');

// agrega likes (total) y likedByMe a una lista de items que tengan id
// tabla/columna: 'post_likes'/'post_id' o 'comentario_likes'/'comentario_id' (constantes internas)
async function agregarLikes(tabla, columna, items, usuarioId) {
    items.forEach((i) => { i.likes = 0; i.likedByMe = false; });
    if (items.length === 0) return items;

    const ids = items.map((i) => i.id);
    const [rows] = await pool.query(
        `SELECT ${columna} AS item_id, COUNT(*) AS total, MAX(usuario_id = ?) AS yo
         FROM ${tabla} WHERE ${columna} IN (?) GROUP BY ${columna}`,
        [usuarioId || 0, ids]
    );

    const porId = new Map(rows.map((r) => [r.item_id, r]));
    items.forEach((i) => {
        const r = porId.get(i.id);
        if (r) {
            i.likes = Number(r.total);
            i.likedByMe = Boolean(r.yo);
        }
    });
    return items;
}

// Pone o quita el like. Es seguro ante doble click / concurrencia: la PK compuesta impide duplicados
// y si dos peticiones intentan crear a la vez, la perdedora simplemente queda con el like ya puesto.
// Devuelve { creado, likes, likedByMe } (creado=true solo si esta llamada inserto el like).
async function toggleLike(tabla, columna, itemId, usuarioId) {
    let creado = false;
    await reintentarDeadlock(async () => {
        const [borrado] = await pool.query(
            `DELETE FROM ${tabla} WHERE ${columna} = ? AND usuario_id = ?`, [itemId, usuarioId]);
        creado = false;
        if (borrado.affectedRows === 0) {
            creado = await ignorarDuplicado(async () => {
                await pool.query(`INSERT INTO ${tabla} (${columna}, usuario_id) VALUES (?, ?)`, [itemId, usuarioId]);
                return true;
            }, false);
        }
    });

    const [item] = await agregarLikes(tabla, columna, [{ id: Number(itemId) }], usuarioId);
    return { creado, likes: item.likes, likedByMe: item.likedByMe };
}

module.exports = { agregarLikes, toggleLike };
