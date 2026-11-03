const { ignorarDuplicado, reintentarDeadlock } = require('../utils/errores');

// Funciones comunes a los likes de posts y de comentarios.
// Modelo/columna: PostLike/'post_id' o ComentarioLike/'comentario_id'.

// agrega likes (total) y likedByMe a una lista de items que tengan id
async function agregarLikes(Modelo, columna, items, usuarioId) {
    items.forEach((i) => { i.likes = 0; i.likedByMe = false; });
    if (items.length === 0) return items;

    const ids = items.map((i) => i.id);
    const totales = await Modelo.count({ where: { [columna]: ids }, group: [columna] });
    const mios = usuarioId
        ? await Modelo.findAll({ where: { [columna]: ids, usuario_id: usuarioId }, attributes: [columna], raw: true })
        : [];

    const porId = new Map(items.map((i) => [i.id, i]));
    totales.forEach((t) => { porId.get(t[columna]).likes = Number(t.count); });
    mios.forEach((m) => { porId.get(m[columna]).likedByMe = true; });
    return items;
}

// Pone o quita el like. Es seguro ante doble click / concurrencia: la PK compuesta impide duplicados
// y si dos peticiones intentan crear a la vez, la perdedora simplemente queda con el like ya puesto.
// Devuelve { creado, likes, likedByMe } (creado=true solo si esta llamada inserto el like).
async function toggleLike(Modelo, columna, itemId, usuarioId) {
    const fila = { [columna]: itemId, usuario_id: usuarioId };
    let creado = false;
    await reintentarDeadlock(async () => {
        const borrados = await Modelo.destroy({ where: fila });
        creado = false;
        if (borrados === 0) {
            creado = await ignorarDuplicado(async () => {
                await Modelo.create(fila);
                return true;
            }, false);
        }
    });

    const [item] = await agregarLikes(Modelo, columna, [{ id: Number(itemId) }], usuarioId);
    return { creado, likes: item.likes, likedByMe: item.likedByMe };
}

module.exports = { agregarLikes, toggleLike };
