export const API_URL = 'http://localhost:8080';

// funcion auxiliar para hacer las peticiones fetch con el token metido
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = options.headers || {};

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // si el body no es FormData le mandamos el content type de json
    const isMultipart = options.body instanceof FormData;
    if (!isMultipart && options.body && typeof options.body === 'object') {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    const fetchOptions = {
        ...options,
        headers
    };

    const response = await fetch(`${API_URL}${endpoint}`, fetchOptions);

    if (response.status === 401 && !endpoint.includes('/api/auth/')) {
        localStorage.clear();
        window.location.href = '/';
        throw new Error('Tu sesion ha expirado. Por favor inicia sesion nuevamente.');
    }

    if (response.status === 204) {
        return null;
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Ocurrio un error en el servidor');
    }

    return data;
}

export const api = {
    login: (correo, password) => {
        return apiRequest('/api/auth/login', {
            method: 'POST',
            body: { correo, password }
        });
    },

    register: (nombre, username, correo, password) => {
        return apiRequest('/api/auth/register', {
            method: 'POST',
            body: { nombre, username, correo, password }
        });
    },

    listarCategorias: () => {
        return apiRequest('/api/categorias', { method: 'GET' });
    },

    listarPosts: (categoriaId = '', buscar = '') => {
        let url = '/api/posts';
        const params = [];
        if (categoriaId) params.push(`categoria=${categoriaId}`);
        if (buscar) params.push(`buscar=${encodeURIComponent(buscar)}`);

        if (params.length > 0) {
            url += '?' + params.join('&');
        }

        return apiRequest(url, { method: 'GET' });
    },

    verPost: (id) => {
        return apiRequest(`/api/posts/${id}`, { method: 'GET' });
    },

    crearPost: (formData) => {
        return apiRequest('/api/posts', {
            method: 'POST',
            body: formData
        });
    },

    eliminarPost: (id) => {
        return apiRequest(`/api/posts/${id}`, { method: 'DELETE' });
    },

    crearComentario: (postId, formData) => {
        return apiRequest(`/api/posts/${postId}/comentarios`, {
            method: 'POST',
            body: formData
        });
    },

    eliminarComentario: (id) => {
        return apiRequest(`/api/comentarios/${id}`, { method: 'DELETE' });
    },

    verPerfil: () => {
        return apiRequest('/api/users/me', { method: 'GET' });
    },

    editarPerfil: (formData) => {
        return apiRequest('/api/users/me', {
            method: 'PUT',
            body: formData
        });
    }
};
