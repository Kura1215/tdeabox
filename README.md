# TdeaVox

Red social interna del Tecnológico de Antioquia (TDEA): publicaciones por categoría y etiquetas, comentarios con respuestas,
likes, seguidores, perfiles, guardados, notificaciones, menciones, insignias, publicaciones anónimas, reportes y panel de administración.

- **Backend:** Node.js + Express + MySQL (`mysql2`), JWT (7 días), bcrypt.
- **Frontend:** React + Vite.

## Requisitos

- Node.js 20.19+ (o 22.12+)
- MySQL 8.0.16+ (usa triggers y FULLTEXT de InnoDB)

## Puesta en marcha

```bash
# 1. Backend
cd backend
cp .env.example .env        # edita DB_PASSWORD, JWT_SECRET y ADMIN_*
npm install
npm run db:init             # crea/actualiza tablas, triggers, índices y siembra categorías + admin
npm run dev                 # http://localhost:8080

# 2. Frontend (otra terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

`npm run db:init` es **idempotente y no borra datos**: si ya tienes la base de una versión anterior, solo agrega las tablas y
columnas que faltan. Se puede ejecutar cuantas veces haga falta.

Si el backend no corre en `http://localhost:8080`, define `VITE_API_URL` en `frontend/.env`.

### Variables de entorno (`backend/.env`)

| Variable | Descripción |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexión a MySQL |
| `JWT_SECRET` | Secreto largo y aleatorio (obligatorio) |
| `JWT_EXPIRATION` | Vigencia de la sesión, `7d` |
| `PORT` | Puerto del backend (8080) |
| `CORS_ORIGINS` | Orígenes del frontend, separados por coma |
| `AUTH_RATE_MAX` | Intentos de registro/login por IP cada 15 min (30) |
| `ADMIN_CORREO`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Admin inicial que crea `db:init` (si falta, no se crea) |
| `DB_POOL` | Conexiones del pool (20) |
| `NODE_ENV=production` | Exige HTTPS (ver más abajo) |
| `UPLOADS_DIR` | Carpeta de imágenes (por defecto `uploads/` en la raíz) |

Nunca subas `backend/.env` (ya está en `.gitignore`).

## Pruebas

```bash
cd backend
npm test        # Jest + Supertest; usa la BD aparte tdeavox_test (se recrea sola en cada corrida)
```

Cubren: auth (dominio, normalización, duplicados concurrentes, rate limiting, MIME falso), posts/etiquetas/feed/filtros/ranking,
anonimato (feed, detalle, perfil, búsqueda, "solo de quienes sigo", comentarios del autor), límites de archivos (2/3/5 MB),
comentarios (respuesta a respuesta bloqueada por API **y** por la BD), likes/seguidores/guardados concurrentes, auto-follow,
notificaciones (sin auto-aviso, sin duplicados), menciones, insignias, reportes duplicados, panel admin y auditoría.

### Prueba de carga

```bash
cd backend
npm run db:seed-carga                                  # crea tdeavox_carga: 20.000 usuarios, 60.000 posts, 120.000 comentarios, 200.000 likes
DB_NAME=tdeavox_carga AUTH_RATE_MAX=1000000 PORT=8081 node server.js   # en otra terminal
npm run carga -- http://localhost:8081 15              # autocannon, 200 conexiones concurrentes
```

Resultado en un equipo de desarrollo (generador de carga y servidor en la misma máquina, MySQL con configuración por defecto):

| Endpoint (200 conexiones) | req/s | p50 | p99 |
|---|---|---|---|
| Feed página 1 | 228 | 0,8 s | 1,5 s |
| Feed con sesión | 224 | 0,8 s | 1,4 s |
| Búsqueda FULLTEXT | 259 | 0,7 s | 1,2 s |
| "Solo de quienes sigo" | 347 | 0,6 s | 1,1 s |
| Ranking semanal | 232 | 0,7 s | 1,6 s |
| Detalle de post / comentarios | 430–456 | 0,4 s | 0,7 s |

Todos los endpoints quedaron bajo 2 s en el p99 con 0 errores.

## Backups (RNF04)

```bash
backend/scripts/backup-db.sh        # diario: mysqldump comprimido, retención 15 días
backend/scripts/backup-uploads.sh   # semanal: tar.gz de uploads/, retención 30 días
```

Programación con cron (en Windows, el Programador de tareas ejecutando los scripts con Git Bash):

```cron
0 2 * * *   /ruta/tdeavox/backend/scripts/backup-db.sh
0 3 * * 0   /ruta/tdeavox/backend/scripts/backup-uploads.sh
```

Los archivos se guardan en `backups/` (o `BACKUP_DIR`). Para restaurar: `gunzip -c archivo.sql.gz | mysql -u root -p tdeavox`.
Copia esa carpeta también a otro equipo o servicio: un backup en el mismo disco no protege contra su falla.

## HTTPS en producción (RNF03)

Con `NODE_ENV=production` el backend responde **426** a cualquier petición que no llegue por HTTPS. Debe ir detrás de un proxy inverso
(nginx, Caddy, etc.) que termine TLS y envíe `X-Forwarded-Proto: https`. Ejemplo mínimo con nginx:

```nginx
server {
    listen 443 ssl;
    server_name tdeavox.tdea.edu.co;
    ssl_certificate     /etc/ssl/tdeavox/fullchain.pem;
    ssl_certificate_key /etc/ssl/tdeavox/privkey.pem;
    client_max_body_size 6m;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

Sirve el frontend compilado (`npm run build` → `frontend/dist`) desde el mismo dominio o define `CORS_ORIGINS` con su origen.

## API

Respuestas de error: `{ "exito": false, "error": "...", "mensaje": "..." }`. Rutas protegidas: `Authorization: Bearer <token>`.

| Método y ruta | Descripción |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login` | Registro (multipart con `foto` opcional) y login; ambos devuelven `{ token, usuarioId, nombre, username, fotoPerfil, rol }` |
| `GET /api/categorias` | Catálogo de categorías |
| `GET /api/posts?categoria&tag&autor&q&desde&hasta&siguiendo&page&limit` | Feed paginado (limit 1–20, por defecto 10) |
| `GET /api/posts/ranking-semanal` | Top de los últimos 7 días (likes, luego comentarios) |
| `POST /api/posts`, `GET/PUT/DELETE /api/posts/:id` | CRUD (multipart: `titulo`, `contenido`, `categoriaId`, `tags`, `esAnonimo`, `imagen`) |
| `POST /api/posts/:id/like`, `POST /api/posts/:id/guardar` | Alternan like / guardado |
| `GET/POST /api/posts/:id/comentarios` | Comentarios raíz paginados con sus respuestas / crear |
| `POST /api/comentarios/:id/respuestas`, `PUT/DELETE /api/comentarios/:id`, `POST /api/comentarios/:id/like` | Responder (1 nivel), editar, borrar, like |
| `GET /api/users/me`, `PUT /api/users/me`, `GET /api/users/me/guardados` | Perfil propio, edición, guardados (privado) |
| `GET /api/users/:id`, `POST /api/users/:id/seguir`, `GET /api/users/:id/seguidores`, `.../seguidos` | Perfil público y seguidores |
| `GET /api/notificaciones`, `PATCH /api/notificaciones/:id`, `POST /api/notificaciones/leer-todas` | Notificaciones |
| `POST /api/reportes` | Reportar post o comentario |
| `GET /api/admin/reportes`, `PATCH /api/admin/reportes/:id`, `DELETE /api/admin/posts/:id`, `DELETE /api/admin/comentarios/:id`, `GET /api/admin/auditoria` | Solo administradores |

## Decisiones de diseño

- **Integridad en la base de datos:** `PRIMARY KEY` compuesta en likes, seguidores, guardados y post_tags; `UNIQUE` en correo, username,
  etiquetas y reportes; triggers para "no seguirte a ti mismo", "máx. 3 etiquetas", "respuestas de un solo nivel del mismo post" y
  "un reporte tiene exactamente un objetivo" (MySQL no permite `CHECK` sobre columnas con `ON DELETE CASCADE`).
  El código captura los errores de duplicado y reintenta ante deadlocks, así que las carreras no producen datos duplicados ni errores 500.
- **Anonimato:** un post anónimo se serializa sin `usuarioId`/username y se excluye de filtros por autor, perfiles públicos y "solo de quienes sigo".
  Los comentarios que el autor haga en su propio post anónimo también se ocultan. Solo el admin recibe `autorReal`.
- **Imágenes:** se validan por firma real (`file-type`), se guardan con nombre aleatorio y se borran si la petición falla o el contenido se elimina.
- **Ranking:** el orden se cachea 60 s en memoria del proceso (si despliegas varias instancias, cada una tiene su caché).
- **El total del feed** se acota a 5.000 resultados para no contar millones de filas.
