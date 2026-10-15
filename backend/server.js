require('dotenv').config();
const { crearApp } = require('./app');

if (!process.env.JWT_SECRET) {
    console.error('Falta JWT_SECRET en el .env');
    process.exit(1);
}

const PORT = process.env.PORT || 8080;
crearApp().listen(PORT, () => {
    console.log(`Servidor TdeaVox corriendo en el puerto ${PORT}`);
});
