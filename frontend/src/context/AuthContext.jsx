import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

function leerUsuarioGuardado() {
    const token = localStorage.getItem('token');
    if (!token) return null;

    return {
        token,
        usuarioId: localStorage.getItem('usuarioId'),
        nombre: localStorage.getItem('nombre'),
        username: localStorage.getItem('username'),
        fotoPerfil: localStorage.getItem('fotoPerfil'),
        rol: localStorage.getItem('rol') || 'usuario'
    };
}

export function AuthProvider({ children }) {
    const [usuario, setUsuario] = useState(leerUsuarioGuardado());

    // el rol se guardo al iniciar sesion; lo refrescamos desde el servidor por si cambio en la BD
    const hayToken = Boolean(usuario?.token);
    useEffect(() => {
        if (!hayToken) return;
        api.sesion().then((s) => {
            localStorage.setItem('rol', s.rol);
            localStorage.setItem('nombre', s.nombre);
            localStorage.setItem('fotoPerfil', s.fotoPerfil || '');
            setUsuario((prev) => (prev ? { ...prev, rol: s.rol, nombre: s.nombre, fotoPerfil: s.fotoPerfil } : prev));
        }).catch(() => {});
    }, [hayToken]);

    function login(token, usuarioId, nombre, username, fotoPerfil, rol = 'usuario') {
        localStorage.setItem('token', token);
        localStorage.setItem('usuarioId', usuarioId);
        localStorage.setItem('nombre', nombre);
        localStorage.setItem('username', username);
        localStorage.setItem('fotoPerfil', fotoPerfil || '');
        localStorage.setItem('rol', rol);

        setUsuario({ token, usuarioId, nombre, username, fotoPerfil, rol });
    }

    function actualizarPerfil(nombre, fotoPerfil) {
        localStorage.setItem('nombre', nombre);
        localStorage.setItem('fotoPerfil', fotoPerfil || '');
        setUsuario((prev) => ({ ...prev, nombre, fotoPerfil }));
    }

    function logout() {
        // se conserva el tema elegido
        ['token', 'usuarioId', 'nombre', 'username', 'fotoPerfil', 'rol'].forEach((k) => localStorage.removeItem(k));
        setUsuario(null);
    }

    return (
        <AuthContext.Provider value={{ usuario, login, logout, actualizarPerfil }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
