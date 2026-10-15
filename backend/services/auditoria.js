const pool = require('../db');

// Registra una accion administrativa (RF08)
async function auditar(adminId, accion, entidad, entidadId, detalle = null) {
    await pool.query(
        'INSERT INTO auditoria_admin (admin_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
        [adminId, accion, entidad, entidadId, detalle ? String(detalle).slice(0, 255) : null]
    );
}

module.exports = { auditar };
