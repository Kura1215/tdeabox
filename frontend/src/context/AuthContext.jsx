import { createContext, useContext, useEffect, useState } from 'react';
import { api, guardarToken, renovarSesion } from '../api';

const AuthContext = createContext(null);

// La sesion ya no se guarda en localStorage (ver api.js): el token vive en memoria y,
// al recargar la pagina, se pide uno nuevo con la cookie HttpOnly.
export function AuthProvider({ children }) {
    const [usuario, setUsuario] = useState(null);
    // mientras se consulta la cookie no sabemos si hay sesion: las rutas esperan
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        // datos que guardaba la version anterior (el token incluido); ya no se usan
        ['token', 'usuarioId', 'nombre', 'username', 'fotoPerfil', 'rol'].forEach((k) => localStorage.removeItem(k));

        // renovar tambien trae el rol y el perfil actuales desde la BD
        renovarSesion()
            .then((s) => setUsuario({
                usuarioId: s.usuarioId, nombre: s.nombre, username: s.username, fotoPerfil: s.fotoPerfil, rol: s.rol
            }))
            .catch(() => setUsuario(null))
            .finally(() => setCargando(false));
    }, []);

    function login(token, usuarioId, nombre, username, fotoPerfil, rol = 'usuario') {
        guardarToken(token);
        setUsuario({ usuarioId, nombre, username, fotoPerfil, rol });
    }

    function actualizarPerfil(nombre, fotoPerfil) {
        setUsuario((prev) => ({ ...prev, nombre, fotoPerfil }));
    }

    // cierra la sesion en el servidor (revoca la cookie y el token) y luego en el navegador
    async function logout() {
        try {
            await api.logout();
        } catch (error) {
            // aunque falle la red, en este navegador la sesion se cierra igual
        }
        guardarToken(null);
        setUsuario(null);
    }

    return (
        <AuthContext.Provider value={{ usuario, cargando, login, logout, actualizarPerfil }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
