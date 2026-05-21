const auth = {
    // Verifica si hay una sesión activa
    isAuthenticated: () => {
        return localStorage.getItem('token') !== null;
    },

    // Inicia sesión guardando los datos en localStorage
    login: (token, usuarioId, nombre, username, fotoPerfil) => {
        localStorage.setItem('token', token);
        localStorage.setItem('usuarioId', usuarioId);
        localStorage.setItem('nombre', nombre);
        localStorage.setItem('username', username);
        localStorage.setItem('fotoPerfil', fotoPerfil || '');
    },

    // Cierra sesión limpiando localStorage y redirigiendo al index
    logout: () => {
        localStorage.clear();
        window.location.href = 'index.html';
    },

    // Obtiene los datos del usuario actual de la sesión
    getCurrentUser: () => {
        return {
            token: localStorage.getItem('token'),
            usuarioId: localStorage.getItem('usuarioId'),
            nombre: localStorage.getItem('nombre'),
            username: localStorage.getItem('username'),
            fotoPerfil: localStorage.getItem('fotoPerfil')
        };
    },

    // Protege las rutas impidiendo accesos no autorizados
    guardRoute: () => {
        const path = window.location.pathname;
        const page = path.substring(path.lastIndexOf('/') + 1);

        // Si la página es index.html o la raíz vacía, es la página de login/registro (Pública)
        const isPublicPage = page === '' || page === 'index.html';

        if (isPublicPage) {
            // Si ya está logueado e intenta ir al login, lo mandamos al feed
            if (auth.isAuthenticated()) {
                window.location.href = 'feed.html';
            }
        } else {
            // Si intenta acceder a una ruta protegida sin sesión, lo mandamos al login
            if (!auth.isAuthenticated()) {
                window.location.href = 'index.html';
            }
        }
    }
};

// Se ejecuta el guardián de rutas inmediatamente al cargar el script
auth.guardRoute();
