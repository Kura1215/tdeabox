package com.tdea.tdeavox.service;

import com.tdea.tdeavox.model.Categoria;
import com.tdea.tdeavox.model.Comentario;
import com.tdea.tdeavox.model.Post;
import com.tdea.tdeavox.model.Usuario;
import com.tdea.tdeavox.repository.CategoriaRepository;
import com.tdea.tdeavox.repository.ComentarioRepository;
import com.tdea.tdeavox.repository.PostRepository;
import com.tdea.tdeavox.repository.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PostService {

    private final PostRepository postRepo;
    private final UsuarioRepository usuarioRepo;
    private final CategoriaRepository categoriaRepo;
    private final ComentarioRepository comentarioRepo;

    public PostService(PostRepository postRepo, UsuarioRepository usuarioRepo,
                       CategoriaRepository categoriaRepo, ComentarioRepository comentarioRepo) {
        this.postRepo = postRepo;
        this.usuarioRepo = usuarioRepo;
        this.categoriaRepo = categoriaRepo;
        this.comentarioRepo = comentarioRepo;
    }

    public List<Map<String, Object>> listar(Integer categoriaId, String buscar) {
        List<Post> posts;
        if (categoriaId != null) {
            posts = postRepo.findByCategoriaIdOrderByFechaCreacionDesc(categoriaId);
        } else if (buscar != null && !buscar.trim().isEmpty()) {
            posts = postRepo.findByTituloContainingIgnoreCaseOrderByFechaCreacionDesc(buscar);
        } else {
            posts = postRepo.findAllByOrderByFechaCreacionDesc();
        }
        return posts.stream().map(this::mapearPost).collect(Collectors.toList());
    }

    public Map<String, Object> verPost(Integer id) {
        Post p = postRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Post no encontrado"));
        Map<String, Object> map = mapearPost(p);

        List<Comentario> comentarios = comentarioRepo.findByPostIdOrderByFechaCreacionAsc(id);
        List<Map<String, Object>> comentariosMap = comentarios.stream().map(c -> {
            Map<String, Object> cmap = new HashMap<>();
            cmap.put("id", c.getId());
            cmap.put("contenido", c.getContenido());
            cmap.put("imagenUrl", c.getImagenUrl() != null ? c.getImagenUrl() : "");
            cmap.put("fechaCreacion", c.getFechaCreacion());
            if (c.getUsuario() != null) {
                cmap.put("usuarioId", c.getUsuario().getId());
                cmap.put("nombreUsuario", c.getUsuario().getNombre());
                cmap.put("usernameUsuario", c.getUsuario().getUsername());
                cmap.put("fotoPerfilUsuario", c.getUsuario().getFotoPerfil() != null ? c.getUsuario().getFotoPerfil() : "");
            }
            return cmap;
        }).collect(Collectors.toList());

        map.put("comentarios", comentariosMap);
        return map;
    }

    public Map<String, Object> crear(String titulo, String contenido, Integer categoriaId, MultipartFile imagen, String correo) {
        Usuario usuario = usuarioRepo.findByCorreo(correo)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        Categoria categoria = categoriaRepo.findById(categoriaId)
                .orElseThrow(() -> new RuntimeException("Categoría no encontrada"));

        Post p = new Post();
        p.setTitulo(titulo);
        p.setContenido(contenido);
        p.setUsuario(usuario);
        p.setCategoria(categoria);
        p.setFechaCreacion(LocalDateTime.now());

        if (imagen != null && !imagen.isEmpty()) {
            p.setImagenUrl(guardarImagen(imagen));
        }

        Post guardado = postRepo.save(p);
        return mapearPost(guardado);
    }

    public Map<String, Object> editar(Integer id, String titulo, String contenido, MultipartFile imagen, String correo) {
        Post p = postRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Post no encontrado"));

        if (!p.getUsuario().getCorreo().equals(correo)) {
            throw new RuntimeException("No tienes permiso para editar este post");
        }

        p.setTitulo(titulo);
        p.setContenido(contenido);

        if (imagen != null && !imagen.isEmpty()) {
            if (p.getImagenUrl() != null) {
                eliminarImagen(p.getImagenUrl());
            }
            p.setImagenUrl(guardarImagen(imagen));
        }

        Post guardado = postRepo.save(p);
        return mapearPost(guardado);
    }

    public void eliminar(Integer id, String correo) {
        Post p = postRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Post no encontrado"));

        if (!p.getUsuario().getCorreo().equals(correo)) {
            throw new RuntimeException("No tienes permiso para eliminar este post");
        }

        if (p.getImagenUrl() != null) {
            eliminarImagen(p.getImagenUrl());
        }

        postRepo.delete(p);
    }

    public List<Map<String, Object>> listarCategorias() {
        return categoriaRepo.findAll().stream().map(c -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", c.getId());
            map.put("nombre", c.getNombre());
            map.put("descripcion", c.getDescripcion());
            return map;
        }).collect(Collectors.toList());
    }

    private Map<String, Object> mapearPost(Post p) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", p.getId());
        map.put("titulo", p.getTitulo());
        map.put("contenido", p.getContenido());
        map.put("imagenUrl", p.getImagenUrl() != null ? p.getImagenUrl() : "");
        map.put("fechaCreacion", p.getFechaCreacion());

        if (p.getUsuario() != null) {
            map.put("usuarioId", p.getUsuario().getId());
            map.put("nombreUsuario", p.getUsuario().getNombre());
            map.put("usernameUsuario", p.getUsuario().getUsername());
            map.put("fotoPerfilUsuario", p.getUsuario().getFotoPerfil() != null ? p.getUsuario().getFotoPerfil() : "");
        }

        if (p.getCategoria() != null) {
            map.put("categoriaId", p.getCategoria().getId());
            map.put("nombreCategoria", p.getCategoria().getNombre());
        }

        return map;
    }

    private String guardarImagen(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }
        try {
            Path rootPath = Paths.get(System.getProperty("user.dir"));
            if (rootPath.getFileName().toString().equals("backend")) {
                rootPath = rootPath.getParent();
            }
            Path uploadsDir = rootPath.resolve("uploads");
            if (!Files.exists(uploadsDir)) {
                Files.createDirectories(uploadsDir);
            }

            String originalName = file.getOriginalFilename();
            String extension = "";
            if (originalName != null && originalName.lastIndexOf(".") != -1) {
                extension = originalName.substring(originalName.lastIndexOf("."));
            }
            String fileName = UUID.randomUUID().toString() + extension;
            Path destination = uploadsDir.resolve(fileName);

            Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
            return "/uploads/" + fileName;
        } catch (IOException e) {
            throw new RuntimeException("Error al guardar la imagen: " + e.getMessage());
        }
    }

    private void eliminarImagen(String imagenUrl) {
        if (imagenUrl == null || !imagenUrl.startsWith("/uploads/")) {
            return;
        }
        try {
            Path rootPath = Paths.get(System.getProperty("user.dir"));
            if (rootPath.getFileName().toString().equals("backend")) {
                rootPath = rootPath.getParent();
            }
            String fileName = imagenUrl.replace("/uploads/", "");
            Path filePath = rootPath.resolve("uploads").resolve(fileName);
            Files.deleteIfExists(filePath);
        } catch (IOException e) {
            // Ignorar errores al eliminar
        }
    }
}
