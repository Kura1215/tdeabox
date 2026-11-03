const { AuditoriaAdmin } = require('../models');

// Registra una accion administrativa (RF08)
async function auditar(adminId, accion, entidad, entidadId, detalle = null) {
    await AuditoriaAdmin.create({
        admin_id: adminId,
        accion,
        entidad,
        entidad_id: entidadId,
        detalle: detalle ? String(detalle).slice(0, 255) : null
    });
}

module.exports = { auditar };
