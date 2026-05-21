# TdeaVox – Guía de Desarrollo Completa

> Plataforma Comunitaria Universitaria para el Tecnológico de Antioquia (TDEA)  
> Curso: Construcción de Software II – 2026  
> Equipo: Miguel Ángel Castilla, Juan Pablo Mazo, Juan Esteban Marín, Juan Sebastián Tamayo

---

## Contexto del Proyecto

TdeaVox es un foro web exclusivo para la comunidad del TDEA. Los estudiantes pueden crear publicaciones por categorías, comentar, subir imágenes y gestionar su perfil. El objetivo es reemplazar los grupos de WhatsApp y correos dispersos con un espacio centralizado.

**Lo que hace la app:**
- Registro e inicio de sesión con correo institucional
- Crear, editar y eliminar publicaciones con categorías e imágenes
- Comentar publicaciones (con imágenes opcionales)
- Ver perfil propio y editar nombre/foto
- Feed principal ordenado por fecha
- Filtrar publicaciones por categoría
- Búsqueda básica por título

**Lo que NO hace en esta versión:**
- Notificaciones en tiempo real
- App móvil nativa
- Chat privado entre usuarios
- Moderación automática con IA
- Integración con SIRA

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | HTML5, CSS3, JavaScript (Vanilla) | — |
| Backend | Java + Spring Boot | 3.x |
| Seguridad | Spring Security + JWT | — |
| Base de datos | MySQL | 8.0 |
| ORM | Spring Data JPA + Hibernate | — |
| Build | Maven | — |

**Importante:** El backend es un monolito simple (un solo proyecto Spring Boot), no microservicios. Esto lo hace más fácil de entender, desplegar y exponer.

---

## Estructura de Carpetas

```
TdeaVox/
│
├── backend/                          ← Proyecto Java Spring Boot (Maven)
│   └── src/main/
│       ├── java/com/tdea/tdeavox/
│       │   ├── TdeaVoxApplication.java
│       │   ├── config/
│       │   │   ├── SecurityConfig.java
│       │   │   └── JwtUtil.java
│       │   ├── controller/
│       │   │   ├── AuthController.java
│       │   │   ├── PostController.java
│       │   │   ├── CommentController.java
│       │   │   └── UserController.java
│       │   ├── model/
│       │   │   ├── Usuario.java
│       │   │   ├── Post.java
│       │   │   ├── Comentario.java
│       │   │   └── Categoria.java
│       │   ├── repository/
│       │   │   ├── UsuarioRepository.java
│       │   │   ├── PostRepository.java
│       │   │   ├── ComentarioRepository.java
│       │   │   └── CategoriaRepository.java
│       │   └── service/
│       │       ├── AuthService.java
│       │       ├── PostService.java
│       │       ├── ComentarioService.java
│       │       └── UserService.java
│       └── resources/
│           ├── application.properties
│           └── schema.sql            ← Script de base de datos
│
├── frontend/                         ← Archivos HTML/CSS/JS estáticos
│   ├── index.html                    ← Login / Registro
│   ├── feed.html                     ← Feed principal
│   ├── post.html                     ← Detalle de un post
│   ├── perfil.html                   ← Perfil del usuario
│   ├── crear-post.html               ← Formulario de creación
│   ├── css/
│   │   └── styles.css               ← Estilos globales (tema retro)
│   └── js/
│       ├── api.js                    ← Funciones fetch() a la API
│       ├── auth.js                   ← Login, registro, logout, JWT
│       ├── feed.js                   ← Cargar y filtrar posts
│       ├── post.js                   ← Ver post y comentarios
│       ├── perfil.js                 ← Ver y editar perfil
│       └── crear-post.js             ← Formulario nuevo post
│
└── uploads/                          ← Imágenes subidas por usuarios
```

---

## Base de Datos – MySQL

### Esquema SQL

```sql
CREATE DATABASE IF NOT EXISTS tdeavox CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tdeavox;

CREATE TABLE categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL,
    descripcion TEXT
);

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    correo VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    foto_perfil VARCHAR(255),
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    contenido TEXT NOT NULL,
    imagen_url VARCHAR(255),
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_id INT NOT NULL,
    categoria_id INT NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE TABLE comentarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contenido TEXT NOT NULL,
    imagen_url VARCHAR(255),
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_id INT NOT NULL,
    post_id INT NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- Categorías iniciales
INSERT INTO categorias (nombre, descripcion) VALUES
('Objetos Perdidos', 'Reporta o busca objetos perdidos en el campus'),
('Académico', 'Anuncios, materiales y noticias académicas'),
('Eventos', 'Actividades, conferencias y eventos del TDEA'),
('General', 'Publicaciones de interés general para la comunidad');
```

### Relaciones

```
usuarios  (1) ──── (N)  posts
usuarios  (1) ──── (N)  comentarios
categorias (1) ─── (N)  posts
posts     (1) ──── (N)  comentarios
```

---

## Backend – Java Spring Boot

### pom.xml – Dependencias Maven

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <dependency>
        <groupId>com.mysql</groupId>
        <artifactId>mysql-connector-j</artifactId>
        <scope>runtime</scope>
    </dependency>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-api</artifactId>
        <version>0.11.5</version>
    </dependency>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-impl</artifactId>
        <version>0.11.5</version>
    </dependency>
    <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-jackson</artifactId>
        <version>0.11.5</version>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
</dependencies>
```

### application.properties

```properties
spring.application.name=tdeavox

# MySQL
spring.datasource.url=jdbc:mysql://localhost:3306/tdeavox?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
spring.datasource.username=root
spring.datasource.password=tdea2026
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver

# JPA
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=false
spring.jpa.database-platform=org.hibernate.dialect.MySQL8Dialect

# Subida de archivos
spring.servlet.multipart.max-file-size=5MB
spring.servlet.multipart.max-request-size=5MB

# JWT
jwt.secret=tdeavox-secret-key-2026-construccion-software
jwt.expiration=86400000

# Puerto
server.port=8080
```

---

### Modelos (Entidades JPA)

**Usuario.java**
```java
package com.tdea.tdeavox.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "usuarios")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private String nombre;
    private String username;
    private String correo;
    private String passwordHash;
    private String fotoPerfil;
    private LocalDateTime fechaRegistro;

    // Getters y Setters
    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getCorreo() { return correo; }
    public void setCorreo(String correo) { this.correo = correo; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getFotoPerfil() { return fotoPerfil; }
    public void setFotoPerfil(String fotoPerfil) { this.fotoPerfil = fotoPerfil; }

    public LocalDateTime getFechaRegistro() { return fechaRegistro; }
    public void setFechaRegistro(LocalDateTime fechaRegistro) { this.fechaRegistro = fechaRegistro; }
}
```

**Post.java**
```java
package com.tdea.tdeavox.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "posts")
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private String titulo;
    private String contenido;
    private String imagenUrl;
    private LocalDateTime fechaCreacion;

    @ManyToOne
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @ManyToOne
    @JoinColumn(name = "categoria_id")
    private Categoria categoria;

    // Getters y Setters
    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }

    public String getContenido() { return contenido; }
    public void setContenido(String contenido) { this.contenido = contenido; }

    public String getImagenUrl() { return imagenUrl; }
    public void setImagenUrl(String imagenUrl) { this.imagenUrl = imagenUrl; }

    public LocalDateTime getFechaCreacion() { return fechaCreacion; }
    public void setFechaCreacion(LocalDateTime fechaCreacion) { this.fechaCreacion = fechaCreacion; }

    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }

    public Categoria getCategoria() { return categoria; }
    public void setCategoria(Categoria categoria) { this.categoria = categoria; }
}
```

**Comentario.java**
```java
package com.tdea.tdeavox.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "comentarios")
public class Comentario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private String contenido;
    private String imagenUrl;
    private LocalDateTime fechaCreacion;

    @ManyToOne
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @ManyToOne
    @JoinColumn(name = "post_id")
    private Post post;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public String getContenido() { return contenido; }
    public void setContenido(String contenido) { this.contenido = contenido; }

    public String getImagenUrl() { return imagenUrl; }
    public void setImagenUrl(String imagenUrl) { this.imagenUrl = imagenUrl; }

    public LocalDateTime getFechaCreacion() { return fechaCreacion; }
    public void setFechaCreacion(LocalDateTime fechaCreacion) { this.fechaCreacion = fechaCreacion; }

    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }

    public Post getPost() { return post; }
    public void setPost(Post post) { this.post = post; }
}
```

**Categoria.java**
```java
package com.tdea.tdeavox.model;

import jakarta.persistence.*;

@Entity
@Table(name = "categorias")
public class Categoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private String nombre;
    private String descripcion;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
}
```

---

### Repositories

```java
// UsuarioRepository.java
package com.tdea.tdeavox.repository;

import com.tdea.tdeavox.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Integer> {
    Optional<Usuario> findByCorreo(String correo);
    boolean existsByCorreo(String correo);
    boolean existsByUsername(String username);
}
```

```java
// PostRepository.java
package com.tdea.tdeavox.repository;

import com.tdea.tdeavox.model.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PostRepository extends JpaRepository<Post, Integer> {
    List<Post> findAllByOrderByFechaCreacionDesc();
    List<Post> findByCategoriaIdOrderByFechaCreacionDesc(Integer categoriaId);
    List<Post> findByTituloContainingIgnoreCaseOrderByFechaCreacionDesc(String keyword);
    List<Post> findByUsuarioIdOrderByFechaCreacionDesc(Integer usuarioId);
}
```

```java
// ComentarioRepository.java
package com.tdea.tdeavox.repository;

import com.tdea.tdeavox.model.Comentario;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ComentarioRepository extends JpaRepository<Comentario, Integer> {
    List<Comentario> findByPostIdOrderByFechaCreacionAsc(Integer postId);
}
```

```java
// CategoriaRepository.java
package com.tdea.tdeavox.repository;

import com.tdea.tdeavox.model.Categoria;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoriaRepository extends JpaRepository<Categoria, Integer> {}
```

---

### Endpoints de la API

Todos los endpoints responden en **JSON**. Las rutas que requieren sesión necesitan el header:
```
Authorization: Bearer <token_jwt>
```

#### Autenticación

| Método | URL | Body | Auth | Descripción |
|--------|-----|------|------|-------------|
| POST | `/api/auth/register` | `{nombre, username, correo, password}` | No | Registro |
| POST | `/api/auth/login` | `{correo, password}` | No | Login, retorna JWT |

#### Posts

| Método | URL | Body | Auth | Descripción |
|--------|-----|------|------|-------------|
| GET | `/api/posts` | — | No | Feed completo |
| GET | `/api/posts?categoria=1` | — | No | Filtrar por categoría |
| GET | `/api/posts?buscar=palabra` | — | No | Buscar por título |
| GET | `/api/posts/{id}` | — | No | Ver post con comentarios |
| POST | `/api/posts` | FormData | Sí | Crear post (con imagen) |
| PUT | `/api/posts/{id}` | FormData | Sí | Editar post propio |
| DELETE | `/api/posts/{id}` | — | Sí | Eliminar post propio |

#### Comentarios

| Método | URL | Body | Auth | Descripción |
|--------|-----|------|------|-------------|
| POST | `/api/posts/{id}/comentarios` | FormData | Sí | Crear comentario |
| DELETE | `/api/comentarios/{id}` | — | Sí | Eliminar comentario propio |

#### Usuarios

| Método | URL | Body | Auth | Descripción |
|--------|-----|------|------|-------------|
| GET | `/api/users/me` | — | Sí | Ver perfil propio |
| PUT | `/api/users/me` | FormData | Sí | Editar nombre y foto |

#### Categorías

| Método | URL | Auth | Descripción |
|--------|-----|------|-------------|
| GET | `/api/categorias` | No | Listar todas las categorías |

---

### JWT – Utilidad

```java
// JwtUtil.java
package com.tdea.tdeavox.config;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private long expiration;

    private Key getKey() {
        return Keys.hmacShaKeyFor(secret.getBytes());
    }

    public String generarToken(String correo) {
        return Jwts.builder()
                .setSubject(correo)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getKey())
                .compact();
    }

    public String extraerCorreo(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getKey())
                .build()
                .parseClaimsJws(token)
                .getBody()
                .getSubject();
    }

    public boolean esValido(String token) {
        try {
            Jwts.parserBuilder().setSigningKey(getKey()).build().parseClaimsJws(token);
            return true;
        } catch (JwtException e) {
            return false;
        }
    }
}
```

---

### SecurityConfig – CORS y JWT Filter

```java
// SecurityConfig.java
package com.tdea.tdeavox.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    public SecurityConfig(JwtFilter jwtFilter) {
        this.jwtFilter = jwtFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfig()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/api/posts", "/api/posts/**",
                                 "/api/categorias", "/uploads/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfig() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5500", "http://127.0.0.1:5500"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
```

```java
// JwtFilter.java
package com.tdea.tdeavox.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;

@Component
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    public JwtFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String header = req.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtUtil.esValido(token)) {
                String correo = jwtUtil.extraerCorreo(token);
                UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(correo, null, new ArrayList<>());
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }

        chain.doFilter(req, res);
    }
}
```

---

### Controllers

**AuthController.java**
```java
package com.tdea.tdeavox.controller;

import com.tdea.tdeavox.config.JwtUtil;
import com.tdea.tdeavox.model.Usuario;
import com.tdea.tdeavox.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtUtil jwtUtil;

    public AuthController(AuthService authService, JwtUtil jwtUtil) {
        this.authService = authService;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        try {
            authService.registrar(body.get("nombre"), body.get("username"),
                                  body.get("correo"), body.get("password"));
            return ResponseEntity.ok(Map.of("mensaje", "Usuario registrado correctamente"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        try {
            Usuario usuario = authService.autenticar(body.get("correo"), body.get("password"));
            String token = jwtUtil.generarToken(usuario.getCorreo());
            return ResponseEntity.ok(Map.of(
                "token", token,
                "usuarioId", usuario.getId(),
                "nombre", usuario.getNombre(),
                "username", usuario.getUsername(),
                "fotoPerfil", usuario.getFotoPerfil() != null ? usuario.getFotoPerfil() : ""
            ));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Credenciales incorrectas"));
        }
    }
}
```

**PostController.java**
```java
package com.tdea.tdeavox.controller;

import com.tdea.tdeavox.model.Post;
import com.tdea.tdeavox.service.PostService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    @GetMapping
    public List<Map<String, Object>> listar(
            @RequestParam(required = false) Integer categoria,
            @RequestParam(required = false) String buscar) {
        return postService.listar(categoria, buscar);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> verPost(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(postService.verPost(id));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<?> crear(
            @RequestParam String titulo,
            @RequestParam String contenido,
            @RequestParam Integer categoriaId,
            @RequestParam(required = false) MultipartFile imagen,
            Authentication auth) {
        try {
            Map<String, Object> post = postService.crear(titulo, contenido, categoriaId, imagen, auth.getName());
            return ResponseEntity.ok(post);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> editar(
            @PathVariable Integer id,
            @RequestParam String titulo,
            @RequestParam String contenido,
            @RequestParam(required = false) MultipartFile imagen,
            Authentication auth) {
        try {
            return ResponseEntity.ok(postService.editar(id, titulo, contenido, imagen, auth.getName()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Integer id, Authentication auth) {
        try {
            postService.eliminar(id, auth.getName());
            return ResponseEntity.ok(Map.of("mensaje", "Post eliminado"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
```

---

### Services

**AuthService.java**
```java
package com.tdea.tdeavox.service;

import com.tdea.tdeavox.model.Usuario;
import com.tdea.tdeavox.repository.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class AuthService {

    private final UsuarioRepository usuarioRepo;
    private final PasswordEncoder encoder;

    public AuthService(UsuarioRepository usuarioRepo, PasswordEncoder encoder) {
        this.usuarioRepo = usuarioRepo;
        this.encoder = encoder;
    }

    public void registrar(String nombre, String username, String correo, String password) {
        if (usuarioRepo.existsByCorreo(correo)) {
            throw new RuntimeException("El correo ya está registrado");
        }
        if (usuarioRepo.existsByUsername(username)) {
            throw new RuntimeException("El username ya está en uso");
        }

        Usuario u = new Usuario();
        u.setNombre(nombre);
        u.setUsername(username);
        u.setCorreo(correo);
        u.setPasswordHash(encoder.encode(password));
        u.setFechaRegistro(LocalDateTime.now());
        usuarioRepo.save(u);
    }

    public Usuario autenticar(String correo, String password) {
        Usuario u = usuarioRepo.findByCorreo(correo)
            .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        if (!encoder.matches(password, u.getPasswordHash())) {
            throw new RuntimeException("Contraseña incorrecta");
        }
        return u;
    }
}
```

---

## Frontend – HTML / CSS / JS

### Diseño – Estilo Retro Universitario

**Inspiración:** El Facebook de 2004–2006. Azul institucional, columnas limpias, tarjetas con bordes, tipografía clásica. Sin gradientes llamativos ni sombras exageradas. Simple, legible y familiar.

### styles.css – Variables y Base

```css
:root {
    --azul: #1a3a5c;
    --azul-claro: #2e6da4;
    --verde: #2e8b57;
    --fondo: #e8edf4;
    --blanco: #ffffff;
    --gris-claro: #dce3ec;
    --gris-medio: #6b7280;
    --texto: #1c1c1e;
    --borde: #c8d0dc;
    --rojo: #cc0000;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: 'Georgia', 'Times New Roman', serif;
    background-color: var(--fondo);
    color: var(--texto);
    font-size: 13px;
    line-height: 1.5;
}

/* Navbar */
nav {
    background-color: var(--azul);
    padding: 8px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 3px solid var(--azul-claro);
    position: sticky;
    top: 0;
    z-index: 100;
}

.nav-logo {
    color: white;
    font-size: 22px;
    font-weight: bold;
    font-family: 'Arial Black', sans-serif;
    letter-spacing: -1px;
    text-decoration: none;
}

.nav-logo span { color: #a8c8f0; }

.nav-links a {
    color: #c8dff5;
    text-decoration: none;
    margin-left: 14px;
    font-size: 12px;
    font-family: Arial, sans-serif;
}

.nav-links a:hover { color: white; text-decoration: underline; }

/* Layout principal */
.container {
    max-width: 960px;
    margin: 16px auto;
    padding: 0 12px;
    display: flex;
    gap: 14px;
}

.sidebar {
    width: 200px;
    flex-shrink: 0;
}

.main-content { flex: 1; }

/* Tarjetas / Cajas */
.box {
    background: var(--blanco);
    border: 1px solid var(--borde);
    border-radius: 4px;
    margin-bottom: 12px;
}

.box-header {
    background: var(--azul-claro);
    color: white;
    padding: 6px 10px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    font-weight: bold;
    border-radius: 3px 3px 0 0;
}

.box-body { padding: 10px; }

/* Post card */
.post-card {
    background: var(--blanco);
    border: 1px solid var(--borde);
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 10px;
    transition: border-color 0.15s;
}

.post-card:hover { border-color: var(--azul-claro); }

.post-card h3 {
    font-size: 15px;
    font-family: Arial, sans-serif;
    color: var(--azul-claro);
    margin-bottom: 4px;
}

.post-card h3 a { color: var(--azul-claro); text-decoration: none; }
.post-card h3 a:hover { text-decoration: underline; }

.post-meta {
    color: var(--gris-medio);
    font-size: 11px;
    font-family: Arial, sans-serif;
    margin-bottom: 8px;
}

.badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 10px;
    font-size: 10px;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: white;
}

.badge-academico  { background: var(--azul); }
.badge-eventos    { background: var(--verde); }
.badge-perdidos   { background: #b45309; }
.badge-general    { background: var(--gris-medio); }

/* Botones */
.btn {
    display: inline-block;
    padding: 6px 14px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 12px;
    font-weight: bold;
    text-decoration: none;
    transition: background 0.15s;
}

.btn-primary { background: var(--azul-claro); color: white; }
.btn-primary:hover { background: var(--azul); }

.btn-danger { background: var(--rojo); color: white; }
.btn-danger:hover { background: #990000; }

.btn-sm { padding: 3px 9px; font-size: 11px; }

/* Formularios */
.form-group { margin-bottom: 10px; }

.form-group label {
    display: block;
    font-family: Arial, sans-serif;
    font-size: 12px;
    font-weight: bold;
    color: var(--texto);
    margin-bottom: 3px;
}

.form-group input,
.form-group textarea,
.form-group select {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--borde);
    border-radius: 3px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    background: white;
    color: var(--texto);
    outline: none;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
    border-color: var(--azul-claro);
}

/* Alertas */
.alerta {
    padding: 8px 12px;
    border-radius: 3px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    margin-bottom: 10px;
    display: none;
}

.alerta-error   { background: #ffe0e0; border: 1px solid var(--rojo); color: var(--rojo); }
.alerta-ok      { background: #e0f0e0; border: 1px solid var(--verde); color: #1a5c30; }

/* Comentarios */
.comentario {
    border-top: 1px solid var(--gris-claro);
    padding: 8px 0;
    font-family: Arial, sans-serif;
    font-size: 12px;
}

.comentario-autor {
    font-weight: bold;
    color: var(--azul-claro);
    margin-right: 6px;
}

/* Filtros de categoría */
.filtros {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 12px;
}

.filtro-btn {
    padding: 4px 12px;
    border: 1px solid var(--borde);
    background: white;
    border-radius: 12px;
    font-family: Arial, sans-serif;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
}

.filtro-btn:hover, .filtro-btn.activo {
    background: var(--azul-claro);
    color: white;
    border-color: var(--azul-claro);
}

/* Responsive */
@media (max-width: 640px) {
    .container { flex-direction: column; }
    .sidebar { width: 100%; }
    nav { flex-direction: column; gap: 8px; }
}

/* Busqueda */
.search-bar {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
}

.search-bar input { flex: 1; }

/* Imagen en post */
.post-img {
    max-width: 100%;
    border-radius: 3px;
    border: 1px solid var(--borde);
    margin-top: 8px;
}
```

---

### api.js – Capa de comunicación con el backend

```javascript
const BASE = 'http://localhost:8080/api';

function getToken() {
    return localStorage.getItem('token');
}

function headers(conAuth = false) {
    const h = { 'Content-Type': 'application/json' };
    if (conAuth) h['Authorization'] = 'Bearer ' + getToken();
    return h;
}

async function get(url, auth = false) {
    const r = await fetch(BASE + url, { headers: headers(auth) });
    return r.json();
}

async function post(url, body, auth = false) {
    const r = await fetch(BASE + url, {
        method: 'POST',
        headers: headers(auth),
        body: JSON.stringify(body)
    });
    return r.json();
}

async function postForm(url, formData, auth = true) {
    const h = {};
    if (auth) h['Authorization'] = 'Bearer ' + getToken();
    const r = await fetch(BASE + url, {
        method: 'POST',
        headers: h,
        body: formData
    });
    return r.json();
}

async function putForm(url, formData, auth = true) {
    const h = {};
    if (auth) h['Authorization'] = 'Bearer ' + getToken();
    const r = await fetch(BASE + url, {
        method: 'PUT',
        headers: h,
        body: formData
    });
    return r.json();
}

async function del(url, auth = true) {
    const r = await fetch(BASE + url, {
        method: 'DELETE',
        headers: headers(auth)
    });
    return r.json();
}
```

---

### auth.js – Sesión y protección de rutas

```javascript
function guardarSesion(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuarioId', data.usuarioId);
    localStorage.setItem('nombre', data.nombre);
    localStorage.setItem('username', data.username);
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = 'index.html';
}

function estaLogueado() {
    return !!localStorage.getItem('token');
}

function requiereAuth() {
    if (!estaLogueado()) window.location.href = 'index.html';
}

function usuarioActual() {
    return {
        id: parseInt(localStorage.getItem('usuarioId')),
        nombre: localStorage.getItem('nombre'),
        username: localStorage.getItem('username')
    };
}
```

---

### Páginas HTML – Estructura

**index.html** — Login y Registro (dos secciones en la misma página, mostrar/ocultar con JS)

**feed.html** — Feed de posts con:
- Navbar
- Sidebar (categorías, enlace a crear post, info del usuario)
- Main (buscador, filtros, lista de post-cards)

**post.html** — Detalle de un post con:
- Contenido completo del post
- Listado de comentarios
- Formulario para comentar (si está logueado)
- Botones editar/eliminar (solo si es el autor)

**crear-post.html** — Formulario para nuevo post:
- Título, categoría, contenido, imagen opcional

**perfil.html** — Perfil del usuario:
- Datos del usuario (nombre, correo, foto)
- Formulario para editar nombre y foto
- Listado de posts del usuario

---

## Flujo de Navegación

```
index.html (Login / Registro)
    ↓ login exitoso
feed.html (Feed principal)
    ├── click en post → post.html?id=X
    ├── click en "Crear Post" → crear-post.html
    └── click en perfil → perfil.html
```

---

## Convenciones de Código

**Java:**
- Nombres de clases en PascalCase: `PostController`, `AuthService`
- Nombres de métodos en camelCase: `listarPosts()`, `crearComentario()`
- Variables locales en camelCase: `usuarioId`, `fechaCreacion`
- Sin comentarios obvios. Comentar solo lógica no trivial en español.

**JavaScript:**
- Funciones en camelCase: `cargarPosts()`, `mostrarError()`
- Constantes en MAYUSCULAS: `const BASE = ...`
- Un archivo JS por página. Funciones compartidas van en `api.js` y `auth.js`

**CSS:**
- Clases en kebab-case: `.post-card`, `.btn-primary`
- Variables CSS en `:root` para todos los colores
- Sin `!important` salvo emergencia real

**HTML:**
- IDs para JS, clases para CSS
- Formularios sin `<form>` nativa — usar `<button>` con `onclick` o event listener

---

## Orden de Implementación Recomendado

1. **Base de datos** — Ejecutar el schema.sql en MySQL
2. **Backend – Configuración** — `application.properties`, `pom.xml`, `JwtUtil`, `SecurityConfig`
3. **Backend – Auth** — Modelos → Repositories → AuthService → AuthController
4. **Backend – Posts** — PostService → PostController
5. **Backend – Comentarios** — ComentarioService → ComentarioController
6. **Backend – Usuarios** — UserService → UserController
7. **Frontend – Estilos** — `styles.css` completo
8. **Frontend – Auth** — `index.html` + `auth.js` + `api.js`
9. **Frontend – Feed** — `feed.html` + `feed.js`
10. **Frontend – Post detalle** — `post.html` + `post.js`
11. **Frontend – Crear post** — `crear-post.html` + `crear-post.js`
12. **Frontend – Perfil** — `perfil.html` + `perfil.js`
13. **Pruebas** — Probar cada endpoint con Postman o Thunder Client
14. **Ajustes finales** — Responsive, mensajes de error, limpieza de código

---

## Instalación y Ejecución Local

### MySQL

> Guía detallada de instalación incluida en la sección: **Configuración de Base de Datos** (ver abajo cuando se complete).

```bash
# Verificar que MySQL esté corriendo
mysql -u root -p

# Ejecutar el schema
USE tdeavox;
SOURCE schema.sql;
```

### Backend

```bash
# Desde la carpeta backend/
mvn spring-boot:run

# El servidor queda en:
# http://localhost:8080
```

### Frontend

Abrir el frontend con **Live Server** (extensión de VS Code / Antigravity) para que corra en `http://127.0.0.1:5500`. Esto es necesario por el CORS configurado.

---

## Notas para el Agente IA (Gemini Flash)

- El proyecto es un monolito Spring Boot, NO microservicios.
- La autenticación es JWT sin Spring Session.
- El frontend consume la API con `fetch()` puro, sin frameworks.
- Las imágenes se guardan en disco en la carpeta `uploads/` y se sirven como estáticos.
- Cada controller recibe la autenticación via `Authentication auth` de Spring Security — el `auth.getName()` devuelve el correo del usuario logueado.
- El modelo relacional tiene 4 tablas: `usuarios`, `posts`, `comentarios`, `categorias`.
- La base de datos es MySQL 8 con el charset `utf8mb4`.
- CORS está configurado para `localhost:5500` y `127.0.0.1:5500` (Live Server).
- No usar Lombok. Todo con getters/setters manuales para que el código sea visible y comprensible.
- No usar DTOs complejos. Los controllers devuelven `Map<String, Object>` simples.
- El diseño es estilo retro — azul institucional, tipografía Georgia/Arial, sin gradientes modernos.

---

---

## Conexión de Base de Datos – Configuración Verificada ✅

| Parámetro | Valor |
|-----------|-------|
| Host | localhost |
| Puerto | 3306 |
| Base de datos | tdeavox |
| Usuario | root |
| Contraseña | tdea2026 |
| MySQL versión | 8.0.46 |
| Estado | ✅ Instalado y funcionando |

**Tablas creadas y verificadas:**
- `categorias` — 4 registros insertados (Objetos Perdidos, Académico, Eventos, General)
- `usuarios` — vacía, lista para registros
- `posts` — vacía, lista para publicaciones
- `comentarios` — vacía, lista para comentarios

**String de conexión JDBC completo:**
```
jdbc:mysql://localhost:3306/tdeavox?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
```

---

*Documento generado para el proyecto TdeaVox – Construcción de Software II – TDEA 2026*
*Conexión de base de datos configurada y verificada el día de la instalación.*

---

## Regla Obligatoria para el Agente IA – README Explicativo

Cada vez que crees o modifiques un archivo del proyecto, debes actualizar el archivo `README.md` en la raíz del proyecto.

El `README.md` es el documento de estudio del equipo. Está escrito en español, en lenguaje simple, para que cualquier integrante pueda leer una sección y entender qué hace ese archivo, por qué existe y cómo se conecta con el resto del sistema. El equipo lo usará para estudiar y preparar la exposición.

### Estructura base del README.md

El README.md debe tener exactamente estas secciones, y se va llenando a medida que se crean los archivos:

```
# TdeaVox – Guía de Estudio del Proyecto

## ¿Qué es TdeaVox?
Foro web para la comunidad del TDEA. Los estudiantes pueden publicar por categorías,
comentar y gestionar su perfil. Reemplaza los grupos de WhatsApp dispersos.

## Cómo correr el proyecto
1. MySQL corriendo en localhost:3306 con la base de datos tdeavox
2. Desde backend/ ejecutar: mvn spring-boot:run  → corre en http://localhost:8080
3. Abrir el frontend con Live Server             → corre en http://127.0.0.1:5500

---

## Archivos del Backend

### TdeaVoxApplication.java
¿Qué hace? ...
¿Por qué existe? ...
¿Cómo funciona? ...
¿Cómo se conecta con el resto? ...

### SecurityConfig.java
¿Qué hace? ...
...

(repetir este bloque por cada archivo Java)

---

## Archivos del Frontend

### api.js
¿Qué hace? ...
¿Por qué existe? ...
¿Cómo funciona? ...

(repetir este bloque por cada archivo JS y HTML)

---

## Base de Datos

### Tabla: usuarios
| Columna        | Tipo         | Para qué sirve                              |
|----------------|--------------|---------------------------------------------|
| id             | INT          | Número único que identifica al usuario      |
| nombre         | VARCHAR(100) | Nombre real del usuario                     |
| username       | VARCHAR(50)  | Apodo único visible en el foro              |
| correo         | VARCHAR(150) | Correo con el que inicia sesión             |
| password_hash  | VARCHAR(255) | Contraseña encriptada con bcrypt            |
| foto_perfil    | VARCHAR(255) | Ruta a la imagen de perfil                  |
| fecha_registro | DATETIME     | Cuándo se registró                          |

(repetir para cada tabla)

---

## Flujos completos

### ¿Qué pasa cuando un usuario hace login?
1. El usuario escribe correo y contraseña en index.html
2. auth.js llama a POST /api/auth/login con esos datos
3. AuthController recibe la petición y llama a AuthService.autenticar()
4. AuthService busca al usuario en la BD y compara la contraseña con bcrypt
5. Si es correcta, JwtUtil genera un token firmado y lo devuelve
6. auth.js guarda el token en localStorage del navegador
7. El usuario es redirigido a feed.html

### ¿Qué pasa cuando un usuario crea un post?
(completar cuando se implemente)

### ¿Qué pasa cuando alguien comenta?
(completar cuando se implemente)

### ¿Qué pasa cuando se filtra por categoría?
(completar cuando se implemente)
```

### Reglas para escribir en el README

1. **Lenguaje simple** — como si se lo explicaras a un compañero que no ha visto el código nunca.
2. **Cada archivo responde cuatro preguntas:** ¿Qué hace? ¿Por qué existe? ¿Cómo funciona? ¿Cómo se conecta con el resto?
3. **Si usas un término técnico**, explícalo en la misma oración. Ejemplo: "JWT (un código cifrado que identifica al usuario sin guardar sesión en el servidor)".
4. **Actualizar siempre** — si modificas un archivo, actualizas su sección en el README antes de terminar esa tarea.
5. **No copiar código en el README** — explicar con palabras qué hace ese código.
6. **Los flujos completos son lo más importante** — el profesor puede preguntar "¿qué pasa cuando hago X?" y el equipo debe saberlo sin ver el código.

### Ejemplo de explicación bien escrita

```
### JwtUtil.java

¿Qué hace?
Genera y valida los tokens JWT. Un JWT es un código cifrado que identifica al usuario
sin necesidad de guardar sesiones en el servidor.

¿Por qué existe?
Cuando haces login, el servidor necesita darte algo que pruebe tu identidad en las
siguientes peticiones. Esta clase crea ese comprobante y también lo verifica.

¿Cómo funciona?
- generarToken(correo): toma el correo del usuario y produce un token firmado con
  una clave secreta definida en application.properties. Expira en 24 horas.
- extraerCorreo(token): lee el token y devuelve el correo que tiene dentro.
- esValido(token): revisa que el token no esté vencido ni haya sido modificado.

¿Cómo se conecta con el resto?
AuthController llama a generarToken() cuando el login es exitoso y manda el token
al frontend. JwtFilter llama a esValido() y extraerCorreo() en cada petición
protegida para identificar quién está haciendo la solicitud.
```
