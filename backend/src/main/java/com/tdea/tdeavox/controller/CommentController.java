package com.tdea.tdeavox.controller;

import com.tdea.tdeavox.service.ComentarioService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
public class CommentController {

    private final ComentarioService comentarioService;

    public CommentController(ComentarioService comentarioService) {
        this.comentarioService = comentarioService;
    }

    @PostMapping("/api/posts/{id}/comentarios")
    public ResponseEntity<?> crear(
            @PathVariable Integer id,
            @RequestParam String contenido,
            @RequestParam(required = false) MultipartFile imagen,
            Authentication auth) {
        try {
            return ResponseEntity.ok(comentarioService.crear(id, contenido, imagen, auth.getName()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/api/comentarios/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Integer id, Authentication auth) {
        try {
            comentarioService.eliminar(id, auth.getName());
            return ResponseEntity.ok(Map.of("mensaje", "Comentario eliminado correctamente"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
