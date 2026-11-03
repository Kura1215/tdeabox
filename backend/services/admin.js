const { Post, Comentario, AuditoriaAdmin, Usuario } = require('../models');
const { eliminarPost, eliminarComentario } = require('./contenido');
const { auditar } = require('./auditoria');
const { ErrorHttp } = require('../utils/errores');
const { datosPaginacion } = require('../utils/validar');

// Borrados directos desde el panel (siempre quedan auditados)
async function borrarPostAdmin(id, admin) {
    if (!(await Post.findByPk(id, { attributes: ['id'] }))) throw new ErrorHttp(404, 'Post no encontrado');
    await eliminarPost(id);
    await auditar(admin.id, 'eliminar_post', 'post', id, 'Eliminado desde el panel de administración');
}

async function borrarComentarioAdmin(id, admin) {
    if (!(await Comentario.findByPk(id, { attributes: ['id'] }))) throw new ErrorHttp(404, 'Comentario no encontrado');
    await eliminarComentario(id);
    await auditar(admin.id, 'eliminar_comentario', 'comentario', id, 'Eliminado desde el panel de administración');
}

async function listarAuditoria(pag) {
    const total = await AuditoriaAdmin.count();
    const filas = await AuditoriaAdmin.findAll({
        include: [{ model: Usuario, as: 'admin', attributes: ['username'] }],
        order: [['fecha', 'DESC'], ['id', 'DESC']],
        limit: pag.limit,
        offset: pag.offset
    });

    return {
        registros: filas.map((a) => ({
            id: a.id, accion: a.accion, entidad: a.entidad, entidadId: a.entidad_id,
            detalle: a.detalle || '', fecha: a.fecha, admin: a.admin ? a.admin.username : '(eliminado)'
        })),
        paginacion: datosPaginacion(total, pag)
    };
}

module.exports = { borrarPostAdmin, borrarComentarioAdmin, listarAuditoria };
