package com.tdea.tdeavox.service;

import com.tdea.tdeavox.model.Comentario;
import com.tdea.tdeavox.model.Post;
import com.tdea.tdeavox.model.Usuario;
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
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class ComentarioService {

    private final ComentarioRepository comentarioRepo;
    private final PostRepository postRepo;
    private final UsuarioRepository usuarioRepo;

    public ComentarioService(ComentarioRepository comentarioRepo, PostRepository postRepo, UsuarioRepository usuarioRepo) {
        this.comentarioRepo = comentarioRepo;
        this.postRepo = postRepo;
        this.usuarioRepo = usuarioRepo;
    }

    public Map<String, Object> crear(Integer postId, String contenido, MultipartFile imagen, String correo) {
        Usuario usuario = usuarioRepo.findByCorreo(correo)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        Post post = postRepo.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post no encontrado"));

        Comentario c = new Comentario();
        c.setContenido(contenido);
        c.setPost(post);
        c.setUsuario(usuario);
        c.setFechaCreacion(LocalDateTime.now());

        if (imagen != null && !imagen.isEmpty()) {
            c.setImagenUrl(guardarImagen(imagen));
        }

        Comentario guardado = comentarioRepo.save(c);
        return mapearComentario(guardado);
    }

    public void eliminar(Integer id, String correo) {
        Comentario c = comentarioRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Comentario no encontrado"));

        if (!c.getUsuario().getCorreo().equals(correo)) {
            throw new RuntimeException("No tienes permiso para eliminar este comentario");
        }

        if (c.getImagenUrl() != null) {
            eliminarImagen(c.getImagenUrl());
        }

        comentarioRepo.delete(c);
    }

    private Map<String, Object> mapearComentario(Comentario c) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", c.getId());
        map.put("contenido", c.getContenido());
        map.put("imagenUrl", c.getImagenUrl() != null ? c.getImagenUrl() : "");
        map.put("fechaCreacion", c.getFechaCreacion());
        map.put("postId", c.getPost().getId());

        if (c.getUsuario() != null) {
            map.put("usuarioId", c.getUsuario().getId());
            map.put("nombreUsuario", c.getUsuario().getNombre());
            map.put("usernameUsuario", c.getUsuario().getUsername());
            map.put("fotoPerfilUsuario", c.getUsuario().getFotoPerfil() != null ? c.getUsuario().getFotoPerfil() : "");
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
