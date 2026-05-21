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
