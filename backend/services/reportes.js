const { sequelize, Reporte, Post, Comentario, Usuario } = require('../models');
const { eliminarPost, eliminarComentario } = require('./contenido');
const { auditar } = require('./auditoria');
const { ErrorHttp, errorMysql } = require('../utils/errores');
const { datosPaginacion } = require('../utils/validar');

// funcion (y no un objeto compartido): Sequelize modifica cada include y aqui se usa dos veces
const autor = () => ({ model: Usuario, as: 'autor', attributes: ['id', 'nombre', 'username'] });

// Reporta un post o comentario (RF08). Un usuario solo puede reportar una vez el mismo contenido (UNIQUE en BD).
async function crearReporte({ tipo, id, motivo, descripcion }, usuario) {
    const Modelo = tipo === 'post' ? Post : Comentario;
    if (!(await Modelo.findByPk(id, { attributes: ['id'] }))) {
        throw new ErrorHttp(404, 'El contenido que intentas reportar no existe');
    }

    try {
        await Reporte.create({
            reportante_id: usuario.id,
            post_id: tipo === 'post' ? id : null,
            comentario_id: tipo === 'comentario' ? id : null,
            tipo_objetivo: tipo,
            motivo,
            descripcion
        });
    } catch (error) {
        if (errorMysql(error).code === 'ER_DUP_ENTRY') throw new ErrorHttp(409, 'Ya reportaste este contenido');
        throw error;
    }
}

// Reportes con el contenido reportado y su autor real (el admin si puede ver autores de posts anonimos)
async function listarReportes(estado, pag) {
    const where = estado ? { estado } : {};
    const total = await Reporte.count({ where });
    const filas = await Reporte.findAll({
        where,
        include: [
            { model: Usuario, as: 'reportante', attributes: ['id', 'username'] },
            { model: Post, as: 'post', attributes: ['id', 'titulo', 'contenido', 'es_anonimo'], include: [autor()] },
            { model: Comentario, as: 'comentario', attributes: ['id', 'contenido', 'post_id'], include: [autor()] }
        ],
        // primero los pendientes, luego los mas recientes
        order: [[sequelize.literal("Reporte.estado = 'pendiente'"), 'DESC'], ['fecha', 'DESC'], ['id', 'DESC']],
        limit: pag.limit,
        offset: pag.offset
    });

    return {
        reportes: filas.map((r) => {
            const real = (r.post && r.post.autor) || (r.comentario && r.comentario.autor);
            let contenido = null;
            if (r.tipo_objetivo === 'post' && r.post) {
                contenido = { id: r.post.id, titulo: r.post.titulo, texto: r.post.contenido, esAnonimo: Boolean(r.post.es_anonimo) };
            } else if (r.tipo_objetivo === 'comentario' && r.comentario) {
                contenido = { id: r.comentario.id, texto: r.comentario.contenido, postId: r.comentario.post_id };
            }
            return {
                id: r.id,
                tipo: r.tipo_objetivo,
                motivo: r.motivo,
                descripcion: r.descripcion || '',
                estado: r.estado,
                fecha: r.fecha,
                reportante: { id: r.reportante.id, username: r.reportante.username },
                contenidoEliminado: r.post_id === null && r.comentario_id === null,
                contenido,
                autorReal: real ? { id: real.id, nombre: real.nombre, username: real.username } : null
            };
        }),
        paginacion: datosPaginacion(total, pag)
    };
}

// Cambia el estado de un reporte; con eliminar=true tambien borra el contenido reportado
async function resolverReporte(id, estado, eliminar, admin) {
    const reporte = await Reporte.findByPk(id);
    if (!reporte) throw new ErrorHttp(404, 'Reporte no encontrado');
    if (eliminar && estado === 'descartado') {
        throw new ErrorHttp(400, 'No se puede descartar un reporte y eliminar el contenido a la vez');
    }

    await reporte.update({ estado });
    await auditar(admin.id, `reporte_${estado}`, 'reporte', id, `Reporte de ${reporte.tipo_objetivo} por ${reporte.motivo}`);

    if (!eliminar) return;
    // el resto de reportes del mismo contenido tambien quedan resueltos
    if (reporte.post_id) {
        await Reporte.update({ estado: 'revisado' }, { where: { post_id: reporte.post_id, estado: 'pendiente' } });
        await eliminarPost(reporte.post_id);
        await auditar(admin.id, 'eliminar_post', 'post', reporte.post_id, `Desde el reporte #${id}`);
    } else if (reporte.comentario_id) {
        await Reporte.update({ estado: 'revisado' }, { where: { comentario_id: reporte.comentario_id, estado: 'pendiente' } });
        await eliminarComentario(reporte.comentario_id);
        await auditar(admin.id, 'eliminar_comentario', 'comentario', reporte.comentario_id, `Desde el reporte #${id}`);
    }
}

module.exports = { crearReporte, listarReportes, resolverReporte };
