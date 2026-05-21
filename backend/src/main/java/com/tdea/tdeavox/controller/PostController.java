package com.tdea.tdeavox.controller;

import com.tdea.tdeavox.service.PostService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
public class PostController {

    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    @GetMapping("/api/posts")
    public List<Map<String, Object>> listar(
            @RequestParam(required = false) Integer categoria,
            @RequestParam(required = false) String buscar) {
        return postService.listar(categoria, buscar);
    }

    @GetMapping("/api/posts/{id}")
    public ResponseEntity<?> verPost(@PathVariable Integer id) {
        try {
            return ResponseEntity.ok(postService.verPost(id));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/api/posts")
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

    @PutMapping("/api/posts/{id}")
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

    @DeleteMapping("/api/posts/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Integer id, Authentication auth) {
        try {
            postService.eliminar(id, auth.getName());
            return ResponseEntity.ok(Map.of("mensaje", "Post eliminado"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/api/categorias")
    public List<Map<String, Object>> listarCategorias() {
        return postService.listarCategorias();
    }
}
