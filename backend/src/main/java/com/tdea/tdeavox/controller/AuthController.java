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
