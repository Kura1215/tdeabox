const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { uploadsDir } = require('./upload');
const { ErrorHttp } = require('../utils/errores');

function responder(res, status, mensaje) {
    res.status(status).json({ exito: false, error: mensaje, mensaje });
}

function noEncontrado(req, res) {
    responder(res, 404, 'Ruta no encontrada');
}

// Middleware central: convierte cualquier error en JSON y borra el archivo subido si la peticion fallo
function manejarErrores(error, req, res, next) {
    if (req.archivoGuardado) {
        fs.unlink(path.join(uploadsDir, req.archivoGuardado), () => {});
    }

    if (res.headersSent) return next(error);

    if (error.type === 'entity.parse.failed') return responder(res, 400, 'JSON mal formado');
    if (error.type === 'entity.too.large') return responder(res, 413, 'La peticion es demasiado grande');
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') return responder(res, 413, 'El archivo supera el tamaño maximo permitido');
        return responder(res, 400, 'Archivo no valido');
    }
    if (error instanceof ErrorHttp) return responder(res, error.status, error.message);
    if (error.code === 'ER_DUP_ENTRY') return responder(res, 409, 'El registro ya existe');
    // SIGNAL de los triggers de integridad
    if (error.sqlState === '45000') return responder(res, 400, error.sqlMessage);
    if (error.code === 'ER_NO_REFERENCED_ROW_2') return responder(res, 400, 'Referencia no valida');

    if (process.env.NODE_ENV !== 'test' || process.env.DEBUG_ERR) console.error(error);
    responder(res, 500, 'Error interno del servidor');
}

module.exports = { manejarErrores, noEncontrado };
