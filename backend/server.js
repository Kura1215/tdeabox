require('dotenv').config();
const { crearApp } = require('./app');
const { sequelize } = require('./models');

if (!process.env.JWT_SECRET) {
    console.error('Falta JWT_SECRET en el .env');
    process.exit(1);
}

const PORT = process.env.PORT || 8080;
const servidor = crearApp().listen(PORT, () => {
    console.log(`Servidor TdeaVox corriendo en el puerto ${PORT}`);
});

servidor.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE' ? `El puerto ${PORT} ya esta en uso (otro backend sigue abierto)` : error);
    process.exit(1);
});

// evita que el navegador reutilice una conexion keep-alive que Node ya cerro (causa de "Failed to fetch" intermitente)
servidor.keepAliveTimeout = 65000;
servidor.headersTimeout = 66000;

// Cierre controlado: deja de aceptar peticiones nuevas, espera las que estan en curso y cierra la BD.
// Si algo se queda colgado, a los 10 s se fuerza la salida.
let cerrando = false;
function cerrar(codigo) {
    if (cerrando) return;
    cerrando = true;
    console.log('Cerrando el servidor...');
    setTimeout(() => process.exit(codigo), 10000).unref();
    servidor.close(() => {
        sequelize.close().finally(() => process.exit(codigo));
    });
}

// Un error no capturado deja el proceso en un estado desconocido: en vez de seguir atendiendo,
// se cierra de forma ordenada con codigo 1 y el supervisor (pm2, systemd, Docker) lo vuelve a iniciar.
process.on('uncaughtException', (error) => {
    console.error('uncaughtException:', error);
    cerrar(1);
});
process.on('unhandledRejection', (motivo) => {
    console.error('unhandledRejection:', motivo);
    cerrar(1);
});

// Ctrl+C o la orden de parada del supervisor: cierre normal
process.on('SIGINT', () => cerrar(0));
process.on('SIGTERM', () => cerrar(0));
