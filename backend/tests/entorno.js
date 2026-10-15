// Se ejecuta antes de cada archivo de test: apunta todo a una BD y una carpeta de uploads de prueba
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'tdeavox_test';
process.env.JWT_SECRET = 'secreto-solo-para-tests';
process.env.JWT_EXPIRATION = '7d';
process.env.UPLOADS_DIR = path.join(os.tmpdir(), 'tdeavox-test-uploads');
process.env.AUTH_RATE_MAX = '100000';
process.env.ADMIN_CORREO = 'admin.test@tdea.edu.co';
process.env.ADMIN_PASSWORD = 'admin-test-1234';
process.env.ADMIN_USERNAME = 'admin_test';
