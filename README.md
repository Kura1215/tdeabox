# TdeaVox – Guía de Estudio del Proyecto

## ¿Qué es TdeaVox?
Foro web para la comunidad del Tecnológico de Antioquia (TDEA). Los estudiantes pueden publicar por categorías, comentar publicaciones de otros compañeros, subir imágenes y gestionar su perfil. El objetivo principal es reemplazar los grupos de WhatsApp y correos dispersos con un espacio centralizado y exclusivo para el campus.

## Cómo correr el proyecto
1. Asegúrate de tener MySQL corriendo en tu computadora (`localhost:3306`) con la base de datos `tdeavox` creada (puedes usar el script `schema.sql`).
2. Abre una terminal en la carpeta `backend/` y ejecuta:
   ```bash
   mvn spring-boot:run
   ```
   Esto encenderá el servidor de Spring Boot en `http://localhost:8080`.
3. Abre la carpeta `frontend/` en tu editor de código e inicia el sitio web usando la extensión **Live Server** de VS Code. Correrá en `http://127.0.0.1:5500`.

---

## Archivos del Backend

### pom.xml
* **¿Qué hace?**: Contiene la lista de "ingredientes" y librerías que necesita el proyecto para funcionar (como Spring Boot, conexión a base de datos MySQL, validaciones y seguridad con tokens JWT).
* **¿Por qué existe?**: Es el archivo de configuración que usa Maven (el gestor de dependencias de Java) para descargar automáticamente todo lo necesario para compilar y ejecutar el proyecto sin que tengamos que descargar archivos manualmente.
* **¿Cómo funciona?**: Especifica la versión de Java que usaremos (Java 17) y define las dependencias del sistema, que son paquetes de código ya escritos por otros desarrolladores que nos facilitan la vida (como crear la API, la seguridad, etc.).
* **¿Cómo se conecta con el resto?**: Le dice a Java cómo armar y construir todo el proyecto. Sin este archivo, el código no compilaría porque no sabría dónde encontrar las herramientas de Spring Boot o MySQL.

### application.properties
* **¿Qué hace?**: Almacena las variables de configuración del backend, como la contraseña de la base de datos, el puerto del servidor y la clave de seguridad para encriptar los tokens.
* **¿Por qué existe?**: En lugar de escribir contraseñas y puertos dentro del código de Java (lo cual es peligroso y difícil de cambiar), los guardamos en este archivo centralizado para poder modificarlos fácilmente.
* **¿Cómo funciona?**: Tiene parejas de clave y valor. Por ejemplo, define que el servidor corre en el puerto `8080`, que nos conectamos a la base de datos `tdeavox` con el usuario `root` y la contraseña `tdea2026`, y que el tamaño máximo de fotos a subir es de 5 megabytes.
* **¿Cómo se conecta con el resto?**: Spring Boot lee automáticamente este archivo al iniciar. Por ejemplo, el módulo de base de datos lee la URL de conexión de aquí para enlazarse con MySQL, y los controladores de archivos usan el tamaño límite configurado aquí.

### schema.sql
* **¿Qué hace?**: Contiene las instrucciones SQL escritas para estructurar y crear las tablas de nuestra base de datos.
* **¿Por qué existe?**: Sirve como el plano de construcción de la base de datos. Permite que cualquier miembro del equipo pueda crear exactamente las mismas tablas en su MySQL local.
* **¿Cómo funciona?**: Crea la base de datos `tdeavox` y cuatro tablas principales: `usuarios` (quienes ingresan al foro), `categorias` (las temáticas de los posts), `posts` (las publicaciones) y `comentarios` (respuestas a los posts). También inserta las 4 categorías iniciales.
* **¿Cómo se conecta con el resto?**: Se ejecuta directamente en el gestor de base de datos de MySQL. Luego, el backend se conecta a esta estructura para leer y guardar la información del foro.

### TdeaVoxApplication.java
* **¿Qué hace?**: Es el punto de partida (la puerta de entrada) por donde arranca a ejecutarse todo nuestro servidor backend en Java.
* **¿Por qué existe?**: Todo programa en Java necesita un método principal llamado `main` para saber desde dónde empezar a leer el código. En Spring Boot, esta clase cumple ese rol.
* **¿Cómo funciona?**: Utiliza una anotación especial `@SpringBootApplication` que le indica al computador que configure automáticamente un entorno web de Spring, y luego ejecuta `SpringApplication.run()` para encender el servidor.
* **¿Cómo se conecta con el resto?**: Al arrancar, escanea todas las carpetas del proyecto en busca de controladores (que atienden las peticiones web), servicios (que tienen la lógica) y repositorios (que hablan con la base de datos) para ponerlos en funcionamiento.

### Usuario.java
* **¿Qué hace?**: Representa a la entidad de un usuario (los datos que tiene cada cuenta registrada en el sistema) dentro del código de Java.
* **¿Por qué existe?**: Permite que el sistema reconozca a un usuario, guarde su información (como el nombre, correo institucional, apodo y foto de perfil) y la maneje de manera estructurada en lugar de trabajar directamente con texto crudo.
* **¿Cómo funciona?**: Se marca con `@Entity` para que el framework JPA (la herramienta que conecta Java con la base de datos) entienda que esta clase mapea directamente contra la tabla `usuarios` en MySQL. Contiene atributos y métodos manuales de acceso (getters y setters) para cada campo.
* **¿Cómo se conecta con el resto?**: Es referenciado en `Post.java` y `Comentario.java` para saber a quién le pertenece cada publicación o respuesta, y es gestionado por `UsuarioRepository` para leer o escribir la información en la base de datos.

### Categoria.java
* **¿Qué hace?**: Representa las categorías temáticas en las que se dividen las publicaciones (como "Académico", "Objetos Perdidos", etc.).
* **¿Por qué existe?**: Sirve para clasificar los posts, facilitando a los usuarios encontrar contenidos de su interés particular de forma organizada.
* **¿Cómo funciona?**: Mapea la tabla `categorias` de la base de datos a código de Java usando JPA. Cuenta con campos para el ID, el nombre de la categoría y su descripción.
* **¿Cómo se conecta con el resto?**: Los posts apuntan a una categoría específica, y es utilizada por los repositorios y servicios para filtrar publicaciones cuando el usuario selecciona un filtro temático en el frontend.

### Post.java
* **¿Qué hace?**: Representa a una publicación realizada por cualquier estudiante o usuario del foro.
* **¿Por qué existe?**: Es el elemento central del foro: almacena el título, el contenido de texto escrito, una imagen opcional, y la fecha de publicación.
* **¿Cómo funciona?**: JPA lo mapea a la tabla `posts`. Utiliza `@ManyToOne` (relación de muchos a uno) para conectarse con la entidad `Usuario` (quien lo publicó) y con `Categoria` (dónde se publicó).
* **¿Cómo se conecta con el resto?**: Se conecta con `Usuario` y `Categoria` para cargar la información de quién escribe y dónde se sitúa. Es consultado por `PostRepository` para armar el feed principal de la aplicación y por `Comentario` para saber a qué post responde cada réplica.

### Comentario.java
* **¿Qué hace?**: Representa a un comentario o respuesta escrito por un usuario en alguna publicación específica.
* **¿Por qué existe?**: Permite que el foro tenga interactividad, haciendo que los estudiantes debatan, respondan dudas u ofrezcan ayuda sobre los temas expuestos.
* **¿Cómo funciona?**: JPA lo mapea a la tabla `comentarios`. Al igual que Post, vincula mediante `@ManyToOne` el usuario autor (`Usuario`) y el post al que pertenece (`Post`).
* **¿Cómo se conecta con el resto?**: Se conecta a un `Post` para saber dónde desplegarse y a un `Usuario` para conocer la autoría del comentario. `ComentarioRepository` se encarga de cargarlos y guardarlos en base de datos.

### UsuarioRepository.java
* **¿Qué hace?**: Define las operaciones para consultar, crear y actualizar usuarios en la base de datos MySQL.
* **¿Por qué existe?**: En vez de escribir código SQL complejo para interactuar con la tabla `usuarios`, esta interfaz hereda `JpaRepository` de Spring Data JPA, que genera automáticamente todas las operaciones básicas de base de datos.
* **¿Cómo funciona?**: Aparte de las funciones básicas (como guardar o buscar por ID), define métodos personalizados que se autogeneran a partir de sus nombres: `findByCorreo` (buscar usuario por email), `existsByCorreo` (validar si el correo ya está registrado) y `existsByUsername` (validar si el nombre de usuario está tomado).
* **¿Cómo se conecta con el resto?**: Es llamado por `AuthService` y `UserService` para validar credenciales, crear nuevas cuentas y actualizar perfiles.

### CategoriaRepository.java
* **¿Qué hace?**: Provee los métodos para acceder y listar las categorías de las publicaciones.
* **¿Por qué existe?**: Permite al sistema leer del MySQL las categorías iniciales creadas y poder mostrárselas al usuario al publicar o filtrar.
* **¿Cómo funciona?**: Extiende `JpaRepository`, dándonos acceso inmediato a métodos predeterminados de base de datos como `findAll()`.
* **¿Cómo se conecta con el resto?**: Los servicios del foro lo consumen para validar que una categoría elegida para un post nuevo realmente exista.

### PostRepository.java
* **¿Qué hace?**: Maneja el acceso y las consultas de base de datos de las publicaciones.
* **¿Por qué existe?**: Permite realizar búsquedas inteligentes y ordenamientos específicos en la base de datos (por ejemplo, mostrar los posts más recientes primero).
* **¿Cómo funciona?**: Contiene consultas autogeneradas mediante nombres de métodos como `findAllByOrderByFechaCreacionDesc()` (feed principal ordenado por fecha de más nuevo a más viejo), `findByCategoriaIdOrderByFechaCreacionDesc()` (posts de un tema ordenados), `findByTituloContainingIgnoreCaseOrderByFechaCreacionDesc()` (búsquedas por texto en el título), y `findByUsuarioIdOrderByFechaCreacionDesc()` (posts creados por un usuario).
* **¿Cómo se conecta con el resto?**: Es el corazón del feed. Lo llama `PostService` para armar los listados que finalmente consume la interfaz web.

### ComentarioRepository.java
* **¿Qué hace?**: Provee las operaciones para leer y guardar comentarios en la base de datos.
* **¿Por qué existe?**: Permite obtener todas las respuestas asociadas a una publicación específica.
* **¿Cómo funciona?**: Contiene la consulta personalizada `findByPostIdOrderByFechaCreacionAsc()`, que trae los comentarios de un post ordenados del más antiguo al más reciente (cronológico) para mantener el hilo de la conversación ordenadamente.
* **¿Cómo se conecta con el resto?**: `ComentarioService` lo consume para cargar la lista de respuestas cuando el frontend solicita el detalle de un post.

### JwtUtil.java
* **¿Qué hace?**: Genera y valida los tokens JWT. Un JWT (Json Web Token) es un código cifrado seguro que identifica al usuario en las peticiones sin tener que guardar datos de sesión en la memoria del servidor.
* **¿Por qué existe?**: Como el backend es una API sin estado, necesita una forma rápida y segura de comprobar que la persona que envía una solicitud realmente ha iniciado sesión y es quien dice ser.
* **¿Cómo funciona?**:
  - `generarToken(correo)`: Toma el correo del usuario y genera un código encriptado con una clave secreta del servidor. Tiene expiración de 24 horas.
  - `extraerCorreo(token)`: Desencripta el token usando la misma clave y extrae el correo electrónico contenido.
  - `esValido(token)`: Verifica que la firma del token coincida y que no esté vencido.
* **¿Cómo se conecta con el resto?**: `AuthController` lo llama al loguearse con éxito para enviar el token al cliente, y `JwtFilter` lo utiliza en cada petición protegida para verificar la firma.

### JwtFilter.java
* **¿Qué hace?**: Intercepta cada petición HTTP que entra al servidor backend para verificar si el usuario tiene permiso de acceder.
* **¿Por qué existe?**: Actúa como un portero. Si una ruta requiere estar autenticado (como crear un post), este filtro revisa si traes un token JWT válido antes de dejar pasar la petición.
* **¿Cómo funciona?**: Lee el encabezado `Authorization`. Si encuentra un token que inicia con `"Bearer "`, lo valida usando `JwtUtil`. Si es correcto, extrae el correo del usuario y lo guarda en el contexto de seguridad de Spring (`SecurityContextHolder`) para registrar que la petición está autorizada.
* **¿Cómo se conecta con el resto?**: Se ejecuta en cada petición web justo antes de que llegue a los controladores. Está registrado dentro de la configuración de seguridad del sistema.

### SecurityConfig.java
* **¿Qué hace?**: Define las reglas globales de seguridad del sistema, configurando los permisos de rutas y la comunicación CORS (intercambio de recursos de origen cruzado).
* **¿Por qué existe?**: Por defecto, Spring Security bloquea todo. Necesitamos este archivo para indicarle qué rutas son públicas (como ver el feed o registrarse) y cuáles requieren estar logueado (como comentar o editar perfil). También es indispensable para permitir que el frontend (puerto 5500) hable con el backend (puerto 8080) sin bloqueos del navegador.
* **¿Cómo funciona?**:
  - Configura el `SecurityFilterChain` permitiendo peticiones públicas a `/api/auth/**`, `/api/posts`, `/api/categorias` y `/uploads/**`, y obligando a autenticar el resto.
  - Define `BCryptPasswordEncoder` para encriptar contraseñas de forma segura.
  - Establece la configuración de CORS permitiendo los orígenes `localhost:5500` y `127.0.0.1:5500` con los métodos HTTP comunes.
* **¿Cómo se conecta con el resto?**: Es la base del sistema de seguridad. Aplica sus reglas a todo el backend y agrega el `JwtFilter` en la cadena de filtros de seguridad para que se ejecute antes de procesar las rutas.

### WebConfig.java
* **¿Qué hace?**: Configura el mapeo de recursos estáticos en Spring Boot. Permite que cuando alguien pida una URL que empiece con `/uploads/`, el servidor busque ese archivo en la carpeta física `uploads/` de la computadora.
* **¿Por qué existe?**: Por defecto, Spring Boot no expone archivos fuera de la carpeta de recursos del proyecto. Como los usuarios suben imágenes que no conocemos de antemano, necesitamos guardarlas en el disco duro real y configurar a Spring para que las sirva como imágenes estáticas en el navegador.
* **¿Cómo funciona?**: Implementa `WebMvcConfigurer` y sobreescribe `addResourceHandlers()`. Detecta dinámicamente si el servidor arrancó desde el directorio raíz o de la carpeta `backend/` para ubicar correctamente la carpeta `uploads` de manera absoluta y asociar las peticiones `/uploads/**` a esa ruta en el disco.
* **¿Cómo se conecta con el resto?**: Cuando el frontend carga un post con imagen (`/uploads/foto.jpg`), el navegador web le pide ese recurso a Spring Boot, y `WebConfig` le dice a Spring de qué parte física del disco debe tomar el archivo para responder al navegador.

### AuthService.java
* **¿Qué hace?**: Contiene las operaciones y lógica de negocio para registrar nuevas cuentas de usuarios y validar su inicio de sesión en el sistema.
* **¿Por qué existe?**: Es la capa de servicios encargada de hacer validaciones de seguridad básicas (como evitar correos duplicados o nombres de usuario ya tomados) y de aplicar el encriptador de contraseñas, separando la lógica del controlador web.
* **¿Cómo funciona?**:
  - `registrar(...)`: Verifica si el correo o el username existen. Si no existen, crea un nuevo objeto `Usuario`, encripta la contraseña de texto plano usando `BCryptPasswordEncoder` y guarda el registro en la base de datos usando `UsuarioRepository`.
  - `autenticar(...)`: Busca al usuario por correo electrónico en la base de datos. Si lo encuentra, compara la contraseña ingresada con el hash guardado usando la función `matches()`. Si no coinciden o no existe el usuario, arroja un error.
* **¿Cómo se conecta con el resto?**: Es inyectado y llamado por `AuthController`. `registrar` se llama en el endpoint `/api/auth/register`, y `autenticar` se llama en `/api/auth/login`.

### PostService.java
* **¿Qué hace?**: Administra toda la lógica del foro relacionada con las publicaciones, incluyendo la subida de imágenes a la carpeta de uploads, la edición/eliminación de posts propios y la consulta del feed.
* **¿Por qué existe?**: Centraliza las reglas de negocio de los posts y se encarga de convertir las entidades JPA a objetos `Map<String, Object>` simples para cumplir con el formato JSON directo esperado por el frontend.
* **¿Cómo funciona?**:
  - `listar(categoriaId, buscar)`: Si se pasa categoría, filtra por ella; si se pasa un término de búsqueda, busca por coincidencia en el título; si no, trae todos los posts más recientes primero.
  - `verPost(id)`: Trae la publicación y recopila todas sus respuestas ordenadas cronológicamente de la base de datos, metiendo los comentarios dentro del mismo mapa del post.
  - `crear(...)`, `editar(...)` y `eliminar(...)`: Gestionan la creación, modificación o borrado de posts. Utilizan funciones internas para guardar nuevas imágenes subidas como `MultipartFile` generando nombres de archivo UUID únicos para evitar colisiones y eliminar las fotos viejas del disco duro. Valida en la edición/borrado que el usuario autenticado sea el creador del post.
* **¿Cómo se conecta con el resto?**: Habla con `PostRepository`, `UsuarioRepository`, `CategoriaRepository` y `ComentarioRepository` para interactuar con la base de datos. Sus métodos son expuestos e invocados desde el controlador `PostController`.

### ComentarioService.java
* **¿Qué hace?**: Gestiona la lógica de negocio para los comentarios (respuestas) que los estudiantes añaden en las publicaciones, permitiendo también subir imágenes adjuntas y eliminar comentarios propios.
* **¿Por qué existe?**: Mantiene separada la lógica de interactividad del foro. Se asegura de validar que un estudiante solo pueda borrar sus propios comentarios y procesa el almacenamiento físico de fotos adjuntas.
* **¿Cómo funciona?**:
  - `crear(postId, contenido, imagen, correo)`: Busca al usuario autor y al post correspondiente. Si el comentario incluye una foto, la guarda físicamente y guarda la ruta en la base de datos.
  - `eliminar(id, correo)`: Verifica que la cuenta que intenta borrar el comentario sea la misma que lo redactó. Elimina el comentario y limpia su imagen asociada del disco.
* **¿Cómo se conecta con el resto?**: Usa `ComentarioRepository`, `PostRepository` y `UsuarioRepository` para persistir los datos. Sus funciones serán llamadas por el controlador `CommentController`.

### UserService.java
* **¿Qué hace?**: Maneja las consultas del perfil del usuario (estudiante) y la edición de sus datos personales como su nombre y foto de perfil.
* **¿Por qué existe?**: Provee al frontend la información personal del usuario logueado y administra los cambios en su cuenta de manera segura.
* **¿Cómo funciona?**:
  - `verPerfil(correo)`: Carga los datos del perfil del usuario y también consulta en la base de datos todos los posts redactados por este usuario en orden cronológico descendente.
  - `editarPerfil(nombre, foto, correo)`: Cambia el nombre visible y/o procesa la subida de una nueva foto de perfil del usuario logueado, eliminando la foto anterior del disco duro si existía.
* **¿Cómo se conecta con el resto?**: Usa `UsuarioRepository` y `PostRepository`. Sus métodos son llamados por el controlador `UserController`.

### AuthController.java
* **¿Qué hace?**: Recibe las peticiones HTTP del frontend relacionadas con el inicio de sesión y el registro de nuevas cuentas de usuario.
* **¿Por qué existe?**: Es la puerta de entrada pública para la autenticación en el foro. Convierte las solicitudes web en llamadas a la lógica de negocio del servicio de autenticación y responde con tokens JWT seguros.
* **¿Cómo funciona?**:
  - `register(...)`: Recibe un mapa con los datos del usuario en formato JSON y llama al servicio `AuthService.registrar()`. Si tiene éxito, devuelve un mensaje de confirmación con código de estado HTTP 200 (OK).
  - `login(...)`: Recibe las credenciales (correo y contraseña), llama a `AuthService.autenticar()` y, si son correctas, genera un token usando `JwtUtil` y devuelve un JSON con el token y datos básicos del usuario.
* **¿Cómo se conecta con el resto?**: El frontend (archivo `auth.js`) lo invoca mediante peticiones POST. Internamente utiliza `AuthService` para verificar la base de datos y `JwtUtil` para firmar los tokens que el frontend usará en adelante.

### PostController.java
* **¿Qué hace?**: Atiende todas las operaciones del foro relativas a las publicaciones de los estudiantes, así como la consulta de la lista de categorías.
* **¿Por qué existe?**: Expone una interfaz de comunicación (API) para que los estudiantes del TDEA puedan navegar por el feed, buscar publicaciones, ver detalles con comentarios, crear posts con fotos adjuntas y editar o eliminar sus propios posts.
* **¿Cómo funciona?**:
  - `listar(...)`: Obtiene todas las publicaciones, permitiendo filtrar por categoría o buscar por texto en el título.
  - `verPost(...)`: Obtiene los detalles de una publicación individual y sus comentarios asociados.
  - `crear(...)`, `editar(...)` y `eliminar(...)`: Gestionan la creación, edición y borrado de posts mediante archivos multipart (FormData) e inyectando la autenticación del usuario actual (`Authentication`).
  - `listarCategorias()`: Retorna una lista estructurada con las categorías existentes.
* **¿Cómo se conecta con el resto?**: El frontend (archivo `api.js`) lo llama para poblar el feed. Se comunica directamente con `PostService` para delegar la lógica y asegurar que solo el creador del post pueda editarlo o borrarlo.

### CommentController.java
* **¿Qué hace?**: Recibe y gestiona las peticiones de los estudiantes para publicar comentarios en posts o eliminarlos.
* **¿Por qué existe?**: Permite a los usuarios debatir y responder de manera interactiva en las publicaciones del foro, asegurando que las acciones cumplan con los controles de acceso definidos.
* **¿Cómo funciona?**:
  - `crear(...)`: Recibe el contenido de texto y una imagen opcional, y llama a `ComentarioService.crear()` para guardarlo asociado al post correspondiente y al usuario autenticado.
  - `eliminar(...)`: Recibe el ID de un comentario y solicita su eliminación a `ComentarioService.eliminar()`, validando que el usuario logueado sea el autor de la respuesta.
* **¿Cómo se conecta con el resto?**: El frontend (`post.js`) lo invoca para publicar respuestas y renderizarlas en tiempo real. Utiliza `ComentarioService` para las tareas de persistencia y eliminación física de recursos.

### UserController.java
* **¿Qué hace?**: Expone los endpoints para consultar y actualizar la información de perfil del estudiante autenticado.
* **¿Por qué existe?**: Permite que el foro despliegue y modifique de forma segura datos personales de la sesión del estudiante, como su foto de perfil y su nombre.
* **¿Cómo funciona?**:
  - `verPerfil(...)`: Lee el correo del contexto de autenticación y solicita a `UserService` el perfil completo (datos personales y lista de posts creados).
  - `editarPerfil(...)`: Permite cambiar el nombre y subir una foto de perfil del usuario logueado en formato `FormData`, llamando a `UserService.editarPerfil()`.
* **¿Cómo se conecta con el resto?**: Es consumido por la página de perfil (`perfil.js`) en el frontend. Se apoya en `UserService` para gestionar la información y el almacenamiento de la imagen de perfil en disco.

---

## Archivos del Frontend

### styles.css
* **¿Qué hace?**: Define toda la presentación visual, diseño y hoja de estilos de la interfaz web de TdeaVox.
* **¿Por qué existe?**: Permite aplicar un diseño consistente y atractivo con estética retro universitaria a todo el frontend (como una intranet de principios de los 2000s) sin depender de librerías o frameworks externos como Bootstrap o Tailwind CSS.
* **¿Cómo funciona?**: 
  - Define variables personalizadas CSS (`:root`) para unificar la paleta de colores del tema universitario retro (azules, verde de éxito, fondo azulado-grisáceo, etc.).
  - Utiliza tipografías específicas (`Georgia` para lectura cómoda de contenido de publicaciones y `Arial` o `Arial Black` para interfaces, encabezados y elementos interactivos rápidos).
  - Diseña una distribución flexible con `flexbox` (barra de navegación sticky, contenedor principal con sidebar lateral y contenido principal) y reglas de respuesta para móviles (`@media`).
  - Proporciona estilos limpios para componentes recurrentes: tarjetas de publicaciones (`.post-card`), widgets en cajas estructuradas (`.box`), botones (`.btn`), alertas de estado (`.alerta`), comentarios (`.comentario`) e imágenes responsivas (`.post-img`).
* **¿Cómo se conecta con el resto?**: Es enlazado mediante la etiqueta `<link rel="stylesheet" href="css/styles.css">` en todas las páginas HTML del frontend (`index.html`, `feed.html`, `post.html`, `crear-post.html`, `perfil.html`) para vestir y dar estructura visual a sus respectivos elementos del DOM.

### index.html
* **¿Qué hace?**: Provee la interfaz visual del portal de acceso de TdeaVox, conteniendo los formularios de inicio de sesión y registro de estudiantes.
* **¿Por qué existe?**: Es el punto de partida visual del sitio web; permite a los alumnos registrar una cuenta o autenticarse para interactuar con la comunidad.
* **¿Cómo funciona?**:
  - Cuenta con un contenedor flex `.login-container` centrado que alberga la caja `.box` de login y de registro.
  - Oculta o muestra dinámicamente uno u otro formulario manipulando la propiedad CSS `display` del elemento a través de JavaScript.
  - Carga secuencialmente los scripts necesarios (`api.js`, `auth.js` e `index.js`) al final del body para no retrasar el renderizado visual.
* **¿Cómo se conecta con el resto?**: Utiliza los estilos de `styles.css`. Envía los formularios a `index.js` para ser procesados y enlazados con las funciones de autenticación y de redirección.

### api.js
* **¿Qué hace?**: Es la biblioteca de peticiones HTTP de frontend que se comunica directamente con la API REST del backend de Spring Boot.
* **¿Por qué existe?**: Evita tener código fetch duplicado y disperso por toda la aplicación, centralizando la URL base del servidor y el control común de cabeceras HTTP.
* **¿Cómo funciona?**:
  - Define una constante `API_URL` apuntando a `http://localhost:8080`.
  - Contiene una función interna `apiRequest(...)` que intercepta las peticiones de frontend, inyecta automáticamente la cabecera de autorización `Authorization: Bearer <token>` si hay sesión activa, y diferencia peticiones de tipo JSON de peticiones de tipo `FormData` (subidas de imágenes).
  - Si el servidor retorna un error de sesión expirada (código HTTP 401), limpia el almacenamiento local y redirige a `index.html`.
* **¿Cómo se conecta con el resto?**: Es cargado en todas las páginas web de la aplicación (`index.html`, `feed.html`, `post.html`, `crear-post.html`, `perfil.html`) como primera dependencia de JavaScript, permitiendo a los scripts controladores de vistas (como `index.js`, `feed.js`) llamar a métodos de datos simples (ej: `api.login()`, `api.listarPosts()`).

### auth.js
* **¿Qué hace?**: Administra la persistencia de la sesión del estudiante autenticado en el navegador y el control de acceso a las rutas protegidas.
* **¿Por qué existe?**: Al ser un backend sin estado basado en JWT, necesitamos gestionar localmente el token recibido tras hacer login y proteger las páginas del sitio para que personas no logueadas no puedan curiosear o publicar.
* **¿Cómo funciona?**:
  - Almacena y remueve valores de `localStorage` (como el token, nombre de usuario y foto de perfil).
  - Define el método `guardRoute()` que revisa la página actual y redirige a `feed.html` si un usuario ya autenticado intenta entrar a la pantalla de login, o a `index.html` si un usuario sin sesión activa intenta navegar en páginas internas.
* **¿Cómo se conecta con el resto?**: Se incluye en todo el sitio web justo después de `api.js` y antes del controlador de la vista. Se ejecuta de inmediato para evitar destellos visuales de contenido protegido a usuarios que no hayan iniciado sesión.

### index.js
* **¿Qué hace?**: Controla las interacciones de los elementos de la interfaz de la pantalla de bienvenida y login (`index.html`).
* **¿Por qué existe?**: Es el puente que conecta los formularios de login y registro en el navegador con la lógica del sistema (`api.js` y `auth.js`) mediante escuchas de eventos (DOM Event Listeners).
* **¿Cómo funciona?**:
  - Captura eventos `click` en los enlaces de alternancia para ocultar la caja de login y mostrar la de registro (y viceversa).
  - Valida el formulario de registro en el navegador (coincidencia y longitud de claves, formato del correo electrónico) y llama al método `api.register()`.
  - Captura el envío de login, ejecuta `api.login()`, y en caso de éxito, registra la sesión usando `auth.login()` y redirige al feed principal tras una animación de alerta exitosa.
* **¿Cómo se conecta con el resto?**: Manipula los elementos del DOM de `index.html`, interactúa con `api.js` para enviar datos al backend, y con `auth.js` para guardar la sesión y redirigir.
### feed.html
* **¿Qué hace?**: Provee la interfaz visual del feed o panel central del foro de TdeaVox.
* **¿Por qué existe?**: Permite a los usuarios navegar por la lista de posts del foro, ver la barra lateral con su información básica de perfil, utilizar el filtro por categoría y realizar búsquedas de publicaciones por título.
* **¿Cómo funciona?**:
  - Utiliza un layout semántico estructurado de dos columnas: una barra lateral (`aside.sidebar`) y un área principal (`main.main-content`).
  - La barra lateral aloja la tarjeta de perfil del usuario y una lista dinámica de botones de categorías.
  - El área principal aloja la barra de búsqueda y el contenedor `#posts-container` donde se inyectan dinámicamente las tarjetas de posts (`.post-card`).
* **¿Cómo se conecta con el resto?**: Utiliza los estilos de `styles.css`. Delega toda su lógica interactiva, peticiones de red y pintado a `feed.js`. Carga a `api.js` y `auth.js` para la validación y consumo de datos.

### feed.js
* **¿Qué hace?**: Controla toda la lógica dinámica de la página del feed principal (`feed.html`).
* **¿Por qué existe?**: Es el encargado de orquestar la obtención de datos del backend (publicaciones y categorías) y la manipulación del DOM para mostrárselos al usuario interactivo.
* **¿Cómo funciona?**:
  - Valida la sesión con `auth.getCurrentUser()` y carga los datos de perfil y el avatar (o un SVG por defecto) en el menú lateral.
  - Obtiene las categorías desde `/api/categorias` y renderiza los botones de filtros, asociando controladores de eventos para recargar las publicaciones al hacer clic.
  - Carga el listado de posts desde `/api/posts` (con o sin búsqueda/filtros) y construye elementos HTML dinámicos para inyectar cada tarjeta de post con sus respectivas insignias y fotos adjuntas.
  - Asocia el botón de cerrar sesión en el menú superior con el método `auth.logout()`.
* **¿Cómo se conecta con el resto?**: Lee y escribe elementos en `feed.html`. Consume los endpoints expuestos en `api.js` y las funciones de sesión y rutas provistas por `auth.js`. Redirige al usuario al detalle de un post al hacer clic en su título o botón de comentarios.

### post.html
* **¿Qué hace?**: Provee la interfaz gráfica detallada para una publicación específica, incluyendo su autoría, fecha, contenido íntegro y la sección completa de hilos de comentarios.
* **¿Por qué existe?**: Permite que los estudiantes ingresen a debatir, responder preguntas o dar retroalimentación sobre un tema publicado en particular, ofreciendo además un formulario para redactar respuestas.
* **¿Cómo funciona?**:
  - Emplea la estructura retro de doble columna. En la barra lateral muestra un botón "Volver al Feed" y el resumen de perfil del estudiante.
  - En la parte central aloja el contenedor `#post-detail-container` para renderizar el post, el contenedor `#comments-list` para listar los comentarios y el formulario `#comment-form` para redactar nuevos mensajes.
* **¿Cómo se conecta con el resto?**: Utiliza la hoja de estilos `styles.css`. Vincula su interactividad, captura de clics y envíos directamente al script controlador `post.js`.

### post.js
* **¿Qué hace?**: Controla la lógica dinámica de la vista de detalle de publicación (`post.html`).
* **¿Por qué existe?**: Es el encargado de leer el parámetro de consulta `id` de la URL, pedir los detalles del post y su lista de comentarios al backend, y habilitar la creación y el borrado de comentarios.
* **¿Cómo funciona?**:
  - Obtiene el ID del post analizando la URL con `URLSearchParams` y realiza una petición `GET` a `/api/posts/{id}`.
  - Renderiza los detalles de la publicación e itera la lista de comentarios en orden cronológico ascendente.
  - Compara el ID del usuario en sesión (`auth`) con el ID del autor de cada comentario. Si coinciden, inyecta un botón "Eliminar" asociado al endpoint de borrado de comentarios (`/api/comentarios/{id}`).
  - Captura el envío de nuevos comentarios, construyendo un objeto `FormData` para soportar la subida opcional de fotos adjuntas y llama a `/api/posts/{id}/comentarios`.
* **¿Cómo se conecta con el resto?**: Interactúa con `post.html` inyectando contenido al DOM. Utiliza `api.js` para hablar con el servidor backend y `auth.js` para validar la sesión del usuario.

### crear-post.html
* **¿Qué hace?**: Provee la interfaz gráfica y el formulario interactivo para que los estudiantes autenticados puedan redactar una nueva publicación en la plataforma.
* **¿Por qué existe?**: Permite descentralizar y democratizar la participación en el foro, dándole a cualquier estudiante la posibilidad de iniciar un hilo temático (pregunta académica, eventos, u objetos perdidos).
* **¿Cómo funciona?**:
  - Presenta una estructura de dos columnas con el estilo retro universitario. La sidebar contiene el botón de retorno rápido "◀ Volver al Feed" y el resumen de perfil de usuario.
  - La sección principal aloja un contenedor de alertas `#create-post-alert` y el formulario `#create-post-form` con campos para el título, selección dinámica de categorías, contenido de texto, y adjuntar de manera opcional una imagen física.
* **¿Cómo se conecta con el resto?**: Consume la hoja de estilos global `styles.css`. Delega toda su interactividad, carga de datos y control de eventos de envío al script `crear-post.js` cargado en la parte final del cuerpo HTML.

### crear-post.js
* **¿Qué hace?**: Controla la lógica dinámica de la pantalla de creación de publicaciones (`crear-post.html`).
* **¿Por qué existe?**: Es responsable de poblar dinámicamente el selector de categorías desde la base de datos, validar que la información requerida haya sido ingresada por el estudiante y enviar la publicación (con su archivo binario de imagen) al servidor.
* **¿Cómo funciona?**:
  - Obtiene los datos del perfil actual desde `auth.js` para rellenar la sidebar y renderizar el avatar offline si no existe foto de perfil.
  - Llama a `api.listarCategorias()` para rellenar dinámicamente el elemento `<select id="post-category">` con las categorías obtenidas del backend.
  - Intercepta el evento `submit` del formulario, valida localmente los campos obligatorios, ensambla un objeto `FormData` y delega el envío a `api.crearPost(formData)`.
  - Ante un éxito, muestra una alerta `.alerta-ok` y redirige al estudiante al feed principal (`feed.html`) tras 1 segundo. Ante un error, muestra una alerta `.alerta-error` y reactiva el botón.
* **¿Cómo se conecta con el resto?**: Escribe y manipula elementos del DOM en `crear-post.html`. Utiliza `api.js` para comunicarse con la API del backend (`/api/categorias` y `/api/posts`) y `auth.js` para extraer los datos de la sesión activa de `localStorage`.

### perfil.html
* **¿Qué hace?**: Provee la interfaz gráfica para la gestión de la cuenta del estudiante y el despliegue cronológico de su historial de publicaciones.
* **¿Por qué existe?**: Permite que cada estudiante personalice su información visible en el foro (como nombre completo y avatar) y supervise de manera consolidada todas las publicaciones que ha redactado, ofreciéndole además la opción de eliminarlas.
* **¿Cómo funciona?**:
  - Utiliza el diseño clásico de doble columna. En la columna de la barra lateral muestra un botón para volver al feed principal y el resumen de perfil.
  - La sección principal aloja un contenedor de alertas `#profile-alert`, el formulario `#profile-form` para editar los datos personales (nombre completo y carga opcional de foto de avatar, con los campos username y correo institucional configurados en modo deshabilitado/solo lectura) y el contenedor `#user-posts-container` que renderiza las tarjetas de publicaciones propias.
* **¿Cómo se conecta con el resto?**: Consume la hoja de estilos retro `css/styles.css`. Vincula sus eventos de interacción, envío de datos y clics de borrado directamente al script controlador `perfil.js`.

### perfil.js
* **¿Qué hace?**: Controla la lógica dinámica de la página de perfil del usuario (`perfil.html`).
* **¿Por qué existe?**: Es responsable de obtener la información completa del usuario autenticado (incluyendo sus posts redactados) desde el backend, inyectarla en la interfaz de usuario, procesar las solicitudes de edición de perfil e interactuar con el endpoint de eliminación de publicaciones.
* **¿Cómo funciona?**:
  - Al cargarse, ejecuta la validación de rutas y realiza una llamada HTTP `GET` a `/api/users/me` mediante `api.verPerfil()`.
  - Mapea los resultados para poblar la sidebar, los inputs del formulario y renderiza cada post en `#user-posts-container`, inyectándole un botón "Eliminar Publicación".
  - Sincroniza la información de sesión actualizando los valores actualizados en `localStorage` (las llaves `nombre` y `fotoPerfil`).
  - Escucha la sumisión de `#profile-form`, construye un `FormData` con los datos del nombre y la nueva foto seleccionada, y realiza un `PUT` a `/api/users/me` mediante `api.editarPerfil()`.
  - Asocia el borrado de posts con confirmación al estudiante y llama a `api.eliminarPost(postId)`.
* **¿Cómo se conecta con el resto?**: Lee y escribe elementos en `perfil.html`. Utiliza `api.js` para realizar llamadas a la API REST y `auth.js` para validar y actualizar la información de la sesión en el almacenamiento local del navegador.

---

## Base de Datos

### Tabla: categorias
| Columna     | Tipo        | Para qué sirve                                           |
|-------------|-------------|----------------------------------------------------------|
| id          | INT         | Número único auto-incremental para identificar la categoría |
| nombre      | VARCHAR(80) | Nombre visible de la categoría (ej. "Objetos Perdidos") |
| descripcion | TEXT        | Explicación de qué tipo de publicaciones van en esta categoría |

### Tabla: usuarios
| Columna        | Tipo         | Para qué sirve                                           |
|----------------|--------------|----------------------------------------------------------|
| id             | INT          | Número único que identifica al usuario                   |
| nombre         | VARCHAR(100) | Nombre real y completo de la persona                     |
| username       | VARCHAR(50)  | Apodo único visible en el foro                           |
| correo         | VARCHAR(150) | Correo electrónico institucional para iniciar sesión      |
| password_hash  | VARCHAR(255) | Contraseña protegida mediante encriptación               |
| foto_perfil    | VARCHAR(255) | Ruta del archivo de imagen del usuario                   |
| fecha_registro | DATETIME     | Fecha y hora exacta en la que se creó la cuenta          |

### Tabla: posts
| Columna      | Tipo         | Para qué sirve                                           |
|--------------|--------------|----------------------------------------------------------|
| id           | INT          | Número único del post                                    |
| titulo       | VARCHAR(200) | Título principal de la publicación                       |
| contenido    | TEXT         | Mensaje o texto del post                                 |
| imagen_url   | VARCHAR(255) | Ruta de la foto subida en el post (si aplica)            |
| fecha_creacion| DATETIME    | Cuándo fue publicado                                     |
| usuario_id   | INT          | Identificador del usuario que lo creó (llave foránea)    |
| categoria_id | INT          | Identificador de la temática seleccionada (llave foránea)|

### Tabla: comentarios
| Columna      | Tipo         | Para qué sirve                                           |
|--------------|--------------|----------------------------------------------------------|
| id           | INT          | Número único del comentario                              |
| contenido    | TEXT         | Texto de la respuesta                                    |
| imagen_url   | VARCHAR(255) | Imagen opcional adjunta al comentario                    |
| fecha_creacion| DATETIME    | Cuándo se comentó                                       |
| usuario_id   | INT          | Quién escribió el comentario (llave foránea)             |
| post_id      | INT          | En cuál publicación se comentó (llave foránea)           |

---

## Flujos completos

### ¿Qué pasa cuando un usuario hace login?
1. El usuario escribe su correo institucional y su contraseña en la página de inicio `index.html`.
2. El archivo de frontend `auth.js` recoge los datos y hace una petición `POST` al servidor backend a la ruta `/api/auth/login`.
3. `AuthController` recibe el correo y contraseña, y llama a `AuthService.autenticar()` para procesarlo.
4. `AuthService` busca en la base de datos al usuario por correo. Si lo encuentra, compara la contraseña ingresada con la contraseña encriptada usando Bcrypt (un método seguro de encriptación).
5. Si coinciden, `JwtUtil` genera un token JWT (un comprobante cifrado que representa al usuario de manera segura).
6. El backend responde con el token JWT y los datos públicos de su perfil.
7. El navegador recibe la respuesta y guarda el token en `localStorage` (la memoria del navegador) para usarlo en futuras peticiones.
8. Finalmente, el usuario es redirigido al feed principal (`feed.html`).

### ¿Qué pasa cuando un usuario crea un post?
1. El usuario completa los campos del formulario en `crear-post.html` (título, contenido, categoría) y selecciona opcionalmente un archivo de imagen.
2. El archivo de frontend `crear-post.js` recolecta los datos y arma un objeto `FormData` (necesario para enviar archivos binarios junto con texto).
3. Hacen una petición `POST` al endpoint `/api/posts` incluyendo el token JWT en el header `Authorization`.
4. El backend intercepta la petición. El `JwtFilter` valida el token y almacena los datos de autenticación del usuario en el contexto de Spring Security.
5. `PostController` recibe la petición mapeando los datos de texto y el archivo binario. Llama a `PostService.crear()`, pasándole el correo del usuario (`auth.getName()`).
6. `PostService` busca al usuario y a la categoría por sus IDs en la base de datos.
7. Si el usuario subió una imagen, el servicio la guarda físicamente en la carpeta `uploads/` del disco con un nombre de archivo único (UUID).
8. Se instancia un objeto `Post`, se le asigna la información recibida, la ruta de la imagen (ej: `/uploads/archivo.jpg`), el autor, la categoría y la hora actual.
9. Se guarda en la base de datos a través de `PostRepository.save()` y se formatea el resultado a un `Map` simple para que el controlador devuelva un JSON.
10. El navegador web recibe la respuesta exitosa y redirige al usuario a `feed.html` donde el post ya aparece en la parte superior del listado.

### ¿Qué pasa cuando alguien comenta?
1. El usuario está visualizando el detalle de un post en `post.html` y escribe una respuesta en la sección de comentarios, pudiendo adjuntar opcionalmente una imagen.
2. El archivo de frontend `post.js` recoge el texto del comentario y el archivo de imagen, armando un objeto `FormData`.
3. Llama por HTTP mediante `POST` a la ruta `/api/posts/{id}/comentarios` enviando el token JWT de autorización.
4. El backend valida el token. `CommentController` intercepta la petición y delega a `ComentarioService.crear()` pasándole el ID del post, el contenido, la imagen y el correo del usuario actual.
5. `ComentarioService` busca el post y al usuario en la base de datos.
6. Guarda la imagen en la carpeta `uploads/` del servidor si el usuario la adjuntó.
7. Crea una entidad `Comentario`, le asigna el texto, el post al que responde, el autor, la ruta de la imagen y la fecha de creación.
8. Persiste el comentario en la base de datos usando `ComentarioRepository.save()`.
9. Retorna la respuesta en formato JSON al frontend.
10. El archivo JavaScript `post.js` recibe el comentario recién creado y lo pinta de manera dinámica en el final de la lista de comentarios sin recargar la página completa.

### ¿Qué pasa cuando se filtra por categoría?
1. El usuario está en `feed.html` y hace clic en uno de los botones de categoría en el menú lateral o filtros superiores.
2. El archivo de frontend `feed.js` detecta el clic y realiza una petición `GET` a la API a la ruta `/api/posts?categoria={id}`.
3. `PostController` recibe la petición mapeando el parámetro opcional `categoria` (que contiene el ID seleccionado) y llama a `PostService.listar(categoria, null)`.
4. `PostService` verifica que el ID de categoría no sea nulo y delega la consulta al repositorio llamando a `PostRepository.findByCategoriaIdOrderByFechaCreacionDesc(categoriaId)`.
5. `PostRepository` realiza la consulta SQL filtrando por la llave foránea `categoria_id` y ordenando los registros de manera descendente por su fecha de creación.
6. El servicio recibe el listado de entidades `Post`, los transforma manualmente a mapas simples `Map<String, Object>` para limpiar la estructura y lo retorna al controlador.
7. `PostController` devuelve la lista en formato JSON al navegador con un código HTTP 200 (OK).
8. El archivo JavaScript `feed.js` en el navegador limpia el contenedor actual de publicaciones y pinta dinámicamente las tarjetas de posts (`post-card`) que pertenecen únicamente a la categoría seleccionada.
