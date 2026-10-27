require('dotenv').config();
const { crearApp } = require('./app');

if (!process.env.JWT_SECRET) {
    console.error('Falta JWT_SECRET en el .env');
    process.exit(1);
}

// Un error suelto (promesa sin catch, error de una conexion MySQL inactiva) no debe tumbar el servidor:
// antes el proceso moria y el frontend mostraba "Failed to fetch" hasta reiniciarlo a mano.
process.on('unhandledRejection', (motivo) => console.error('unhandledRejection:', motivo));
process.on('uncaughtException', (error) => console.error('uncaughtException:', error));

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
