package com.tdea.tdeavox.service;

import com.tdea.tdeavox.model.Post;
import com.tdea.tdeavox.model.Usuario;
import com.tdea.tdeavox.repository.PostRepository;
import com.tdea.tdeavox.repository.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UsuarioRepository usuarioRepo;
    private final PostRepository postRepo;

    public UserService(UsuarioRepository usuarioRepo, PostRepository postRepo) {
        this.usuarioRepo = usuarioRepo;
        this.postRepo = postRepo;
    }

    public Map<String, Object> verPerfil(String correo) {
        Usuario u = usuarioRepo.findByCorreo(correo)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        
        Map<String, Object> map = mapearUsuario(u);

        // Fetch posts written by this user
        List<Post> posts = postRepo.findByUsuarioIdOrderByFechaCreacionDesc(u.getId());
        List<Map<String, Object>> postsMap = posts.stream().map(p -> {
            Map<String, Object> pmap = new HashMap<>();
            pmap.put("id", p.getId());
            pmap.put("titulo", p.getTitulo());
            pmap.put("contenido", p.getContenido());
            pmap.put("imagenUrl", p.getImagenUrl() != null ? p.getImagenUrl() : "");
            pmap.put("fechaCreacion", p.getFechaCreacion());
            if (p.getCategoria() != null) {
                pmap.put("categoriaId", p.getCategoria().getId());
                pmap.put("nombreCategoria", p.getCategoria().getNombre());
            }
            return pmap;
        }).collect(Collectors.toList());

        map.put("posts", postsMap);
        return map;
    }

    public Map<String, Object> editarPerfil(String nombre, MultipartFile foto, String correo) {
        Usuario u = usuarioRepo.findByCorreo(correo)
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));

        if (nombre != null && !nombre.trim().isEmpty()) {
            u.setNombre(nombre);
        }

        if (foto != null && !foto.isEmpty()) {
            if (u.getFotoPerfil() != null) {
                eliminarImagen(u.getFotoPerfil());
            }
            u.setFotoPerfil(guardarImagen(foto));
        }

        Usuario guardado = usuarioRepo.save(u);
        return mapearUsuario(guardado);
    }

    private Map<String, Object> mapearUsuario(Usuario u) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", u.getId());
        map.put("nombre", u.getNombre());
        map.put("username", u.getUsername());
        map.put("correo", u.getCorreo());
        map.put("fotoPerfil", u.getFotoPerfil() != null ? u.getFotoPerfil() : "");
        map.put("fechaRegistro", u.getFechaRegistro());
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
            // Ignorar
        }
    }
}
