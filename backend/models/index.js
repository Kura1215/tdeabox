// Modelos del ORM (Sequelize). Cada modelo representa una tabla de schema.sql y sus atributos se llaman
// igual que las columnas. Las tablas, indices y triggers los sigue creando `npm run db:init`
// (por eso no se usa sequelize.sync()); las restricciones NOT NULL, UNIQUE y FK las aplica MySQL.
require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

// Las fechas se guardan en hora local; usamos el mismo desfase que Node (p. ej. -05:00)
// para que las fechas que ya estan en la BD no se corran al leerlas.
function desfaseLocal() {
    const minutos = -new Date().getTimezoneOffset();
    const abs = Math.abs(minutos);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `${minutos >= 0 ? '+' : '-'}${hh}:${mm}`;
}

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    timezone: desfaseLocal(),
    logging: false,
    pool: { max: Number(process.env.DB_POOL) || 20 },
    // mantiene vivas las conexiones inactivas para que MySQL/el SO no las cierre
    dialectOptions: { enableKeepAlive: true, keepAliveInitialDelay: 10000 },
    // las tablas ya tienen su nombre definitivo y no usan createdAt/updatedAt
    define: { freezeTableName: true, timestamps: false }
});

// funciones (y no objetos compartidos): Sequelize modifica la definicion de cada atributo
const id = () => ({ type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true });
const clave = () => ({ type: DataTypes.INTEGER, primaryKey: true });

const Categoria = sequelize.define('Categoria', {
    id: id(),
    nombre: DataTypes.STRING(80),
    descripcion: DataTypes.TEXT
}, { tableName: 'categorias' });

const Usuario = sequelize.define('Usuario', {
    id: id(),
    nombre: DataTypes.STRING(100),
    username: DataTypes.STRING(50),
    correo: DataTypes.STRING(150),
    password_hash: DataTypes.STRING(255),
    foto_perfil: DataTypes.STRING(255),
    biografia: DataTypes.STRING(200),
    programa_academico: DataTypes.STRING(80),
    rol: DataTypes.ENUM('usuario', 'admin'),
    fecha_registro: DataTypes.DATE
}, { tableName: 'usuarios' });

const Post = sequelize.define('Post', {
    id: id(),
    titulo: DataTypes.STRING(200),
    contenido: DataTypes.TEXT,
    imagen_url: DataTypes.STRING(255),
    es_anonimo: DataTypes.BOOLEAN,
    editado: DataTypes.BOOLEAN,
    editado_at: DataTypes.DATE,
    fecha_creacion: DataTypes.DATE,
    usuario_id: DataTypes.INTEGER,
    categoria_id: DataTypes.INTEGER
}, { tableName: 'posts' });

const Comentario = sequelize.define('Comentario', {
    id: id(),
    contenido: DataTypes.TEXT,
    imagen_url: DataTypes.STRING(255),
    editado: DataTypes.BOOLEAN,
    fecha_creacion: DataTypes.DATE,
    usuario_id: DataTypes.INTEGER,
    post_id: DataTypes.INTEGER,
    comentario_padre_id: DataTypes.INTEGER
}, { tableName: 'comentarios' });

// tablas con clave primaria compuesta (evitan duplicados)
const PostLike = sequelize.define('PostLike', { post_id: clave(), usuario_id: clave() }, { tableName: 'post_likes' });
const ComentarioLike = sequelize.define('ComentarioLike', { comentario_id: clave(), usuario_id: clave() }, { tableName: 'comentario_likes' });
const PostTag = sequelize.define('PostTag', { post_id: clave(), tag_id: clave() }, { tableName: 'post_tags' });
const Seguidor = sequelize.define('Seguidor', {
    seguidor_id: clave(), seguido_id: clave(), fecha: DataTypes.DATE
}, { tableName: 'seguidores' });
const Guardado = sequelize.define('Guardado', {
    usuario_id: clave(), post_id: clave(), fecha: DataTypes.DATE
}, { tableName: 'guardados' });

const Tag = sequelize.define('Tag', { id: id(), nombre: DataTypes.STRING(30) }, { tableName: 'tags' });

const Notificacion = sequelize.define('Notificacion', {
    id: id(),
    usuario_id: DataTypes.INTEGER,
    actor_id: DataTypes.INTEGER,
    tipo: DataTypes.ENUM('comentario', 'like', 'seguidor', 'mencion'),
    mensaje: DataTypes.STRING(150),
    referencia_id: DataTypes.INTEGER,
    leido: DataTypes.BOOLEAN,
    clave: DataTypes.STRING(80),
    fecha: DataTypes.DATE
}, { tableName: 'notificaciones' });

const Reporte = sequelize.define('Reporte', {
    id: id(),
    reportante_id: DataTypes.INTEGER,
    post_id: DataTypes.INTEGER,
    comentario_id: DataTypes.INTEGER,
    tipo_objetivo: DataTypes.ENUM('post', 'comentario'),
    motivo: DataTypes.ENUM('spam', 'contenido_inapropiado', 'otro'),
    descripcion: DataTypes.STRING(300),
    estado: DataTypes.ENUM('pendiente', 'revisado', 'descartado'),
    fecha: DataTypes.DATE
}, { tableName: 'reportes' });

const AuditoriaAdmin = sequelize.define('AuditoriaAdmin', {
    id: id(),
    admin_id: DataTypes.INTEGER,
    accion: DataTypes.STRING(50),
    entidad: DataTypes.STRING(30),
    entidad_id: DataTypes.INTEGER,
    detalle: DataTypes.STRING(255),
    fecha: DataTypes.DATE
}, { tableName: 'auditoria_admin' });

// Sesiones abiertas (cookie de renovacion). Borrar la fila = cerrar/revocar la sesion.
const Sesion = sequelize.define('Sesion', {
    id: id(),
    usuario_id: DataTypes.INTEGER,
    token_hash: DataTypes.CHAR(64),
    expira: DataTypes.DATE,
    fecha_creacion: DataTypes.DATE
}, { tableName: 'sesiones' });

// Relaciones (solo las que usan los servicios en sus consultas)
Post.belongsTo(Usuario, { as: 'autor', foreignKey: 'usuario_id' });
Post.belongsTo(Categoria, { as: 'categoria', foreignKey: 'categoria_id' });
Comentario.belongsTo(Usuario, { as: 'autor', foreignKey: 'usuario_id' });
PostLike.belongsTo(Post, { as: 'post', foreignKey: 'post_id' });
PostTag.belongsTo(Tag, { as: 'tag', foreignKey: 'tag_id' });
Seguidor.belongsTo(Usuario, { as: 'usuarioSeguidor', foreignKey: 'seguidor_id' });
Seguidor.belongsTo(Usuario, { as: 'usuarioSeguido', foreignKey: 'seguido_id' });
Reporte.belongsTo(Usuario, { as: 'reportante', foreignKey: 'reportante_id' });
Reporte.belongsTo(Post, { as: 'post', foreignKey: 'post_id' });
Reporte.belongsTo(Comentario, { as: 'comentario', foreignKey: 'comentario_id' });
AuditoriaAdmin.belongsTo(Usuario, { as: 'admin', foreignKey: 'admin_id' });
Sesion.belongsTo(Usuario, { as: 'usuario', foreignKey: 'usuario_id' });

module.exports = {
    sequelize, Categoria, Usuario, Post, Comentario, PostLike, ComentarioLike, PostTag, Tag,
    Seguidor, Guardado, Notificacion, Reporte, AuditoriaAdmin, Sesion
};
