const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname);
        cb(null, randomUUID() + extension);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

function eliminarImagen(imagenUrl) {
    if (!imagenUrl || !imagenUrl.startsWith('/uploads/')) return;
    const fileName = imagenUrl.replace('/uploads/', '');
    const filePath = path.join(uploadsDir, fileName);
    fs.unlink(filePath, () => {});
}

module.exports = { upload, eliminarImagen, uploadsDir };
