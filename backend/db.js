require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL) || 20,
    // mantiene vivas las conexiones inactivas para que MySQL/el SO no las cierre y fallen en la siguiente consulta
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

module.exports = pool;
