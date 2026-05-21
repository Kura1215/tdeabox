package com.tdea.tdeavox.controller;

import com.tdea.tdeavox.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<?> verPerfil(Authentication auth) {
        try {
            return ResponseEntity.ok(userService.verPerfil(auth.getName()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/me")
    public ResponseEntity<?> editarPerfil(
            @RequestParam(required = false) String nombre,
            @RequestParam(required = false) MultipartFile foto,
            Authentication auth) {
        try {
            return ResponseEntity.ok(userService.editarPerfil(nombre, foto, auth.getName()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
