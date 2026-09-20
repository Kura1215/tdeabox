import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

function leerUsuarioGuardado() {
    const token = localStorage.getItem('token');
    if (!token) return null;

    return {
        token,
        usuarioId: localStorage.getItem('usuarioId'),
        nombre: localStorage.getItem('nombre'),
        username: localStorage.getItem('username'),
        fotoPerfil: localStorage.getItem('fotoPerfil')
    };
}

export function AuthProvider({ children }) {
    const [usuario, setUsuario] = useState(leerUsuarioGuardado());

    function login(token, usuarioId, nombre, username, fotoPerfil) {
        localStorage.setItem('token', token);
        localStorage.setItem('usuarioId', usuarioId);
        localStorage.setItem('nombre', nombre);
        localStorage.setItem('username', username);
        localStorage.setItem('fotoPerfil', fotoPerfil || '');

        setUsuario({ token, usuarioId, nombre, username, fotoPerfil });
    }

    function actualizarPerfil(nombre, fotoPerfil) {
        localStorage.setItem('nombre', nombre);
        localStorage.setItem('fotoPerfil', fotoPerfil || '');
        setUsuario((prev) => ({ ...prev, nombre, fotoPerfil }));
    }

    function logout() {
        localStorage.clear();
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
