// Crea o actualiza el esquema sin borrar datos: ejecuta schema.sql, agrega las columnas
// nuevas a tablas antiguas, crea indices/triggers y siembra categorias y admin.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const COLUMNAS_NUEVAS = [
    ['usuarios', 'biografia', 'VARCHAR(200) NULL'],
    ['usuarios', 'programa_academico', 'VARCHAR(80) NULL'],
    ['usuarios', 'rol', "ENUM('usuario','admin') NOT NULL DEFAULT 'usuario'"],
    ['posts', 'es_anonimo', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['posts', 'editado', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['posts', 'editado_at', 'DATETIME NULL'],
    ['comentarios', 'comentario_padre_id', 'INT NULL'],
    ['comentarios', 'editado', 'TINYINT(1) NOT NULL DEFAULT 0']
];

const INDICES = [
    ['posts', 'idx_posts_fecha', 'CREATE INDEX idx_posts_fecha ON posts (fecha_creacion)'],
    ['posts', 'idx_posts_cat_fecha', 'CREATE INDEX idx_posts_cat_fecha ON posts (categoria_id, fecha_creacion)'],
    ['posts', 'idx_posts_usuario', 'CREATE INDEX idx_posts_usuario ON posts (usuario_id)'],
    ['posts', 'ft_posts', 'CREATE FULLTEXT INDEX ft_posts ON posts (titulo, contenido)'],
    ['comentarios', 'idx_comentarios_post', 'CREATE INDEX idx_comentarios_post ON comentarios (post_id)'],
    ['comentarios', 'idx_comentarios_padre', 'CREATE INDEX idx_comentarios_padre ON comentarios (comentario_padre_id)'],
    ['notificaciones', 'idx_notif_destino', 'CREATE INDEX idx_notif_destino ON notificaciones (usuario_id, leido)']
];

// Reglas que no se pueden expresar con CHECK porque MySQL no las permite junto a ON DELETE CASCADE
const TRIGGERS = {
    seguidores_no_auto: `CREATE TRIGGER seguidores_no_auto BEFORE INSERT ON seguidores FOR EACH ROW
        BEGIN
            IF NEW.seguidor_id = NEW.seguido_id THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No puedes seguirte a ti mismo';
            END IF;
        END`,
    comentarios_un_nivel: `CREATE TRIGGER comentarios_un_nivel BEFORE INSERT ON comentarios FOR EACH ROW
        BEGIN
            DECLARE padre_del_padre INT;
            DECLARE post_del_padre INT;
            IF NEW.comentario_padre_id IS NOT NULL THEN
                SELECT comentario_padre_id, post_id INTO padre_del_padre, post_del_padre
                FROM comentarios WHERE id = NEW.comentario_padre_id;
                IF padre_del_padre IS NOT NULL THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se puede responder a una respuesta';
                END IF;
                IF post_del_padre <> NEW.post_id THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El comentario padre es de otro post';
                END IF;
            END IF;
        END`,
    post_tags_max3: `CREATE TRIGGER post_tags_max3 BEFORE INSERT ON post_tags FOR EACH ROW
        BEGIN
            IF (SELECT COUNT(*) FROM post_tags WHERE post_id = NEW.post_id) >= 3 THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Maximo 3 etiquetas por post';
            END IF;
        END`,
    reportes_un_objetivo: `CREATE TRIGGER reportes_un_objetivo BEFORE INSERT ON reportes FOR EACH ROW
        BEGIN
            IF (NEW.post_id IS NULL) = (NEW.comentario_id IS NULL) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El reporte debe tener exactamente un objetivo';
            END IF;
        END`
};

async function existeColumna(c, tabla, columna) {
    const [r] = await c.query(
        'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
        [tabla, columna]);
    return r.length > 0;
}

async function existeIndice(c, tabla, indice) {
    const [r] = await c.query(
        'SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
        [tabla, indice]);
    return r.length > 0;
}

async function inicializar({ nombreBD = process.env.DB_NAME, sembrar = true } = {}) {
    const c = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        multipleStatements: true
    });

    try {
        await c.query(`CREATE DATABASE IF NOT EXISTS \`${nombreBD}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await c.query(`USE \`${nombreBD}\``);

        const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8')
            .replace(/CREATE DATABASE[^;]*;/i, '')
            .replace(/USE [^;]*;/i, '');
        await c.query(sql);

        for (const [tabla, columna, def] of COLUMNAS_NUEVAS) {
            if (!(await existeColumna(c, tabla, columna))) {
                await c.query(`ALTER TABLE \`${tabla}\` ADD COLUMN \`${columna}\` ${def}`);
            }
        }

        // FK de respuestas: se agrega aparte porque la columna puede venir de una version anterior
        const [fk] = await c.query(
            `SELECT 1 FROM information_schema.table_constraints
             WHERE table_schema = DATABASE() AND table_name = 'comentarios' AND constraint_name = 'fk_comentario_padre'`);
        if (fk.length === 0) {
            await c.query(`ALTER TABLE comentarios ADD CONSTRAINT fk_comentario_padre
                FOREIGN KEY (comentario_padre_id) REFERENCES comentarios(id) ON DELETE CASCADE`);
        }

        for (const [tabla, nombre, sentencia] of INDICES) {
            if (!(await existeIndice(c, tabla, nombre))) await c.query(sentencia);
        }

        for (const [nombre, sentencia] of Object.entries(TRIGGERS)) {
            await c.query(`DROP TRIGGER IF EXISTS ${nombre}`);
            await c.query(sentencia);
        }

        if (sembrar) await sembrarDatos(c);
    } finally {
        await c.end();
    }
}

async function sembrarDatos(c) {
    await c.query(`INSERT INTO categorias (id, nombre, descripcion) VALUES
        (1, 'Objetos Perdidos', 'Reporta o busca objetos perdidos en el campus'),
        (2, 'Academico', 'Anuncios, materiales y noticias academicas'),
        (3, 'Eventos', 'Actividades, conferencias y eventos del TDEA'),
        (4, 'General', 'Publicaciones de interes general para la comunidad')
        ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), descripcion = VALUES(descripcion)`);

    const correo = (process.env.ADMIN_CORREO || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (correo && password) {
        const hash = await bcrypt.hash(password, 10);
        await c.query(
            `INSERT INTO usuarios (nombre, username, correo, password_hash, rol)
             VALUES (?, ?, ?, ?, 'admin')
             ON DUPLICATE KEY UPDATE rol = 'admin'`,
            ['Administrador', process.env.ADMIN_USERNAME || 'admin', correo, hash]);
    }
}

module.exports = { inicializar };

if (require.main === module) {
    inicializar()
        .then(() => { console.log('Base de datos lista'); })
        .catch((e) => { console.error(e); process.exit(1); });
}
