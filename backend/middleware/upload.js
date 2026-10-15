const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const FileType = require('file-type');
const { ErrorHttp } = require('../utils/errores');

const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// tipos permitidos y limite segun el contexto (RF01/RF03/RF02)
const CONTEXTOS = {
    perfil: { maxMB: 2, tipos: ['image/jpeg', 'image/png', 'image/webp'] },
    comentario: { maxMB: 3, tipos: ['image/jpeg', 'image/png', 'image/webp'] },
    post: { maxMB: 5, tipos: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] }
};

// Middleware: recibe un archivo en memoria, valida su firma real (no la extension ni el mimetype
// del cliente) y solo entonces lo escribe en disco con nombre aleatorio.
// Si la peticion falla despues, el middleware de errores borra el archivo (req.archivoGuardado).
function subir(campo, contexto) {
    const { maxMB, tipos } = CONTEXTOS[contexto];
    const recibir = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: maxMB * 1024 * 1024, files: 1 }
    }).single(campo);

    return (req, res, next) => {
        recibir(req, res, async (error) => {
            if (error) return next(error);
            if (!req.file) return next();

            try {
                const tipo = await FileType.fromBuffer(req.file.buffer);
                if (!tipo || !tipos.includes(tipo.mime)) {
                    throw new ErrorHttp(400, 'Tipo de archivo no permitido. Formatos validos: ' +
                        tipos.map((t) => t.replace('image/', '').toUpperCase()).join(', '));
                }
                const nombre = `${randomUUID()}.${tipo.ext}`;
                await fs.promises.writeFile(path.join(uploadsDir, nombre), req.file.buffer);
                req.file.filename = nombre;
                req.file.buffer = undefined;
                req.archivoGuardado = nombre;
                next();
            } catch (e) {
                next(e);
            }
        });
    };
}

function eliminarImagen(imagenUrl) {
    if (!imagenUrl || !imagenUrl.startsWith('/uploads/')) return;
    const fileName = path.basename(imagenUrl);
    fs.unlink(path.join(uploadsDir, fileName), () => {});
}

module.exports = { subir, eliminarImagen, uploadsDir };
