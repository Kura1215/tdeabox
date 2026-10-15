CREATE DATABASE IF NOT EXISTS tdeavox CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tdeavox;

CREATE TABLE IF NOT EXISTS categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    descripcion TEXT
);

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    correo VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    foto_perfil VARCHAR(255),
    biografia VARCHAR(200),
    programa_academico VARCHAR(80),
    rol ENUM('usuario','admin') NOT NULL DEFAULT 'usuario',
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    contenido TEXT NOT NULL,
    imagen_url VARCHAR(255),
    es_anonimo TINYINT(1) NOT NULL DEFAULT 0,
    editado TINYINT(1) NOT NULL DEFAULT 0,
    editado_at DATETIME NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_id INT NOT NULL,
    categoria_id INT NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE TABLE IF NOT EXISTS comentarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contenido TEXT NOT NULL,
    imagen_url VARCHAR(255),
    editado TINYINT(1) NOT NULL DEFAULT 0,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_id INT NOT NULL,
    post_id INT NOT NULL,
    comentario_padre_id INT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- Los likes de posts y comentarios son dos tablas con PK compuesta (unicidad por usuario)
CREATE TABLE IF NOT EXISTS post_likes (
    post_id INT NOT NULL,
    usuario_id INT NOT NULL,
    PRIMARY KEY (post_id, usuario_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comentario_likes (
    comentario_id INT NOT NULL,
    usuario_id INT NOT NULL,
    PRIMARY KEY (comentario_id, usuario_id),
    FOREIGN KEY (comentario_id) REFERENCES comentarios(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS post_tags (
    post_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (post_id, tag_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS seguidores (
    seguidor_id INT NOT NULL,
    seguido_id INT NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (seguidor_id, seguido_id),
    FOREIGN KEY (seguidor_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (seguido_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS guardados (
    usuario_id INT NOT NULL,
    post_id INT NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, post_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- clave evita notificaciones repetidas (ej. like / quitar / like)
CREATE TABLE IF NOT EXISTS notificaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    actor_id INT NULL,
    tipo ENUM('comentario','like','seguidor','mencion') NOT NULL,
    mensaje VARCHAR(150) NOT NULL,
    referencia_id INT NULL,
    leido TINYINT(1) NOT NULL DEFAULT 0,
    clave VARCHAR(80) NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_notif_clave (usuario_id, clave),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Si se borra el contenido reportado el reporte se conserva (post_id / comentario_id quedan NULL)
CREATE TABLE IF NOT EXISTS reportes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reportante_id INT NOT NULL,
    post_id INT NULL,
    comentario_id INT NULL,
    tipo_objetivo ENUM('post','comentario') NOT NULL,
    motivo ENUM('spam','contenido_inapropiado','otro') NOT NULL,
    descripcion VARCHAR(300) NULL,
    estado ENUM('pendiente','revisado','descartado') NOT NULL DEFAULT 'pendiente',
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_reporte_post (reportante_id, post_id),
    UNIQUE KEY uq_reporte_comentario (reportante_id, comentario_id),
    FOREIGN KEY (reportante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL,
    FOREIGN KEY (comentario_id) REFERENCES comentarios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS auditoria_admin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NULL,
    accion VARCHAR(50) NOT NULL,
    entidad VARCHAR(30) NOT NULL,
    entidad_id INT NULL,
    detalle VARCHAR(255),
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
