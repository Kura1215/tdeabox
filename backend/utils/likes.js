const pool = require('../db');

// agrega likes (total) y likedByMe a una lista de items que tengan id
// tabla/columna: 'post_likes'/'post_id' o 'comentario_likes'/'comentario_id'
async function agregarLikes(tabla, columna, items, correo) {
    items.forEach((i) => { i.likes = 0; i.likedByMe = false; });
    if (items.length === 0) return items;

    const ids = items.map((i) => i.id);
    const [rows] = await pool.query(
        `SELECT l.${columna} AS item_id, COUNT(*) AS total, MAX(u.correo = ?) AS yo
         FROM ${tabla} l JOIN usuarios u ON u.id = l.usuario_id
         WHERE l.${columna} IN (?) GROUP BY l.${columna}`,
        [correo || '', ids]
    );

    rows.forEach((r) => {
        const item = items.find((i) => i.id === r.item_id);
        item.likes = Number(r.total);
        item.likedByMe = Boolean(r.yo);
    });
    return items;
}

// pone o quita el like del usuario y devuelve el estado actual
async function toggleLike(tabla, columna, itemId, correo) {
    const [usuarios] = await pool.query('SELECT id FROM usuarios WHERE correo = ?', [correo]);
    if (usuarios.length === 0) throw new Error('Usuario no encontrado');
    const usuarioId = usuarios[0].id;

    const [existe] = await pool.query(`SELECT 1 FROM ${tabla} WHERE ${columna} = ? AND usuario_id = ?`, [itemId, usuarioId]);
    if (existe.length > 0) {
        await pool.query(`DELETE FROM ${tabla} WHERE ${columna} = ? AND usuario_id = ?`, [itemId, usuarioId]);
    } else {
        await pool.query(`INSERT INTO ${tabla} (${columna}, usuario_id) VALUES (?, ?)`, [itemId, usuarioId]);
    }

    const [item] = await agregarLikes(tabla, columna, [{ id: Number(itemId) }], correo);
    return { likes: item.likes, likedByMe: item.likedByMe };
}

module.exports = { agregarLikes, toggleLike };
