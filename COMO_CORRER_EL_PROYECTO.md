# Guía de Uso - Cómo Correr el Proyecto TdeaVox

Esta guía contiene los pasos necesarios para descargar, configurar y ejecutar localmente el foro estudiantil **TdeaVox** (Backend en Spring Boot + Frontend en Vanilla HTML/CSS/JS).

---

## 1. Requisitos Previos

Antes de comenzar, asegúrate de tener instaladas las siguientes herramientas en tu máquina de desarrollo:

*   **Java Development Kit (JDK) 17**: Requerido para compilar y ejecutar el backend de Spring Boot.
*   **Apache Maven (3.8+)**: Gestor de dependencias utilizado para construir el proyecto backend.
*   **MySQL Server (8.0+)**: Servidor de base de datos relacional para almacenar usuarios, categorías, posts y comentarios.
*   **Git**: Sistema de control de versiones para descargar y clonar el repositorio.
*   **Visual Studio Code con la extensión Live Server**: Servidor web local de desarrollo para alojar el frontend en el puerto autorizado `5500`.

---

## 2. Instrucciones de Instalación y Configuración

### Paso A: Clonar el Repositorio
Abre tu consola de comandos o Git Bash y ejecuta:
```bash
git clone <URL_DEL_REPOSITORIO>
cd tdeabox
```

### Paso B: Configurar las Variables de Entorno (Cuentas y Claves)
Por motivos de seguridad, los archivos de configuración con credenciales y llaves de cifrado reales no se suben al repositorio público. Debes crear el archivo de propiedades en la siguiente ruta:
`backend/src/main/resources/application.properties`

Copia el siguiente bloque de configuración y asegúrate de pedir los valores secretos reemplazados por `PEDIR_AL_EQUIPO` a tus compañeros:

```properties
spring.application.name=tdeavox

# MySQL - Configuración de conexión a la base de datos
spring.datasource.url=jdbc:mysql://localhost:3306/tdeavox?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
spring.datasource.username=root
spring.datasource.password=PEDIR_AL_EQUIPO
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver

# JPA / Hibernate - Validación del esquema de la base de datos
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=false
spring.jpa.database-platform=org.hibernate.dialect.MySQL8Dialect

# Subida de archivos - Límite de tamaño para imágenes
spring.servlet.multipart.max-file-size=5MB
spring.servlet.multipart.max-request-size=5MB

# JWT - Clave secreta y tiempo de expiración (24 horas)
jwt.secret=PEDIR_AL_EQUIPO
jwt.expiration=86400000

# Puerto del servidor backend
server.port=8080
```

### Paso C: Crear la Base de Datos
1.  Asegúrate de que tu servicio local de MySQL esté encendido.
2.  Abre tu herramienta cliente de MySQL (consola, MySQL Workbench, DBeaver, etc.) y ejecuta la sentencia para crear la base de datos:
    ```sql
    CREATE DATABASE tdeavox;
    ```
3.  Selecciona la base de datos recién creada e inyecta la estructura de tablas y datos semilla iniciales ejecutando el archivo [schema.sql](file:///c:/Trabajo/tdeabox/backend/src/main/resources/schema.sql) que encontrarás en la ruta:
    `backend/src/main/resources/schema.sql`

    *Si usas consola de comandos:*
    ```bash
    mysql -u root -p tdeavox < backend/src/main/resources/schema.sql
    ```

### Paso D: Crear la Carpeta de Subidas Físicas (Manual)
Dado que las imágenes subidas por los estudiantes se guardan de forma física en el servidor local y esta carpeta se encuentra ignorada en Git para no contaminar el repositorio, **debes crear manualmente la carpeta `uploads` en la raíz del proyecto** (al mismo nivel que `backend` y `frontend`).
```bash
# Estando en la raíz de la carpeta de trabajo:
mkdir uploads
```

---

## 3. Ejecutar el Proyecto

### Levantar el Backend (Puerto 8080)
1.  Abre una terminal o consola y dirígete al subdirectorio del backend:
    ```bash
    cd backend
    ```
2.  Compila y ejecuta la aplicación Spring Boot mediante Maven:
    ```bash
    mvn spring-boot:run
    ```
3.  Una vez iniciado verás una línea similar a `Started TdeaVoxApplication in X.XXX seconds`. El servidor estará escuchando peticiones REST en `http://localhost:8080`.

### Levantar el Frontend (Puerto 5500)
1.  Abre la carpeta raíz del proyecto (`tdeabox`) en Visual Studio Code.
2.  Haz clic derecho sobre el archivo `frontend/index.html` y selecciona **Open with Live Server** (o presiona el botón "Go Live" en la esquina inferior derecha de tu VS Code).
3.  El navegador web abrirá automáticamente el portal de acceso en `http://localhost:5500` o `http://127.0.0.1:5500`.

> [!CAUTION]
> **IMPORTANTE: ¿Por qué NO se puede abrir el HTML con doble clic directamente desde el disco?**
> Si abres los archivos HTML del frontend con doble clic (utilizando el protocolo `file:///` del navegador en lugar de `http://`), el navegador bloqueará todas las peticiones `fetch()` dirigidas al backend (`http://localhost:8080`) debido a las políticas de seguridad de origen cruzado (CORS). El servidor backend solo aceptará y procesará llamadas HTTP provenientes de los orígenes locales del frontend configurados en el puerto `5500` (`http://localhost:5500` y `http://127.0.0.1:5500`).

---

## 4. Estructura de Carpetas del Proyecto

El repositorio está organizado de la siguiente manera:

*   `backend/`: Código fuente en Java 17 y configuración del servidor Spring Boot 3.x.
    *   `src/main/java/.../`: Entidades JPA, repositorios de Spring Data, servicios de negocio, controladores REST y filtros de seguridad JWT.
    *   `src/main/resources/`: Propiedades de la aplicación y scripts SQL del esquema (`schema.sql`).
*   `frontend/`: Código fuente de la interfaz del usuario.
    *   `css/styles.css`: Estilos visuales globales de tema retro universitario.
    *   `js/`: Controladores de interacción, enrutamiento, validación y cliente de red (`api.js`, `auth.js`).
    *   Páginas HTML: `index.html` (Login/Registro), `feed.html` (Feed Principal), `post.html` (Detalle de Publicación) y `perfil.html` (Mi Perfil).
*   `uploads/`: Carpeta física en el servidor que almacena temporalmente las imágenes asociadas a publicaciones, comentarios y avatares subidos.
*   `README.md`: Documentación académica explicativa de diseño y preguntas de estudio.
*   `COMO_CORRER_EL_PROYECTO.md`: Esta guía de uso y ejecución rápida.
