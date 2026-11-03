// Recrea desde cero la BD de pruebas (nunca toca la BD de desarrollo)
require('dotenv').config();
const mysql = require('mysql2/promise');

module.exports = async () => {
    process.env.ADMIN_CORREO = 'admin.test@tdea.edu.co';
    process.env.ADMIN_PASSWORD = 'admin-test-1234';
    process.env.ADMIN_USERNAME = 'admin_test';

    const c = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    });
    await c.query('DROP DATABASE IF EXISTS tdeavox_test');
    await c.end();

    const { inicializar } = require('../scripts/initdb');
    await inicializar({ nombreBD: 'tdeavox_test' });
};
