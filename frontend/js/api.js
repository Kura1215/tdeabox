const API_URL = 'http://localhost:8080';

// Función auxiliar para realizar peticiones HTTP con fetch
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = options.headers || {};

    // Si tenemos token de autenticación guardado, lo agregamos
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Si el cuerpo NO es FormData, le ponemos tipo JSON
    const isMultipart = options.body instanceof FormData;
    if (!isMultipart && options.body && typeof options.body === 'object') {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    const fetchOptions = {
        ...options,
        headers
    };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, fetchOptions);

        // Si el token expiró o es inválido (401), limpiamos sesión y vamos al login
        if (response.status === 401 && !endpoint.includes('/api/auth/')) {
            localStorage.clear();
            window.location.href = 'index.html';
            throw new Error('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        }

        // Si la respuesta es vacía o exitosa sin contenido
        if (response.status === 204) {
            return null;
        }

        // Intentar parsear el JSON
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Ocurrió un error en el servidor');
        }

        return data;
    } catch (error) {
        console.error('Error en apiRequest:', error);
        throw error;
    }
}

// Objeto global con todos los llamados a la API de TdeaVox
const api = {
    // Autenticación
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

    // Categorías
    listarCategorias: () => {
        return apiRequest('/api/categorias', {
            method: 'GET'
        });
    },

    // Publicaciones (Posts)
    listarPosts: (categoriaId = null, buscar = '') => {
        let url = '/api/posts';
        const params = [];
        if (categoriaId) params.push(`categoria=${categoriaId}`);
        if (buscar) params.push(`buscar=${encodeURIComponent(buscar)}`);
        
        if (params.length > 0) {
            url += '?' + params.join('&');
        }

        return apiRequest(url, {
            method: 'GET'
        });
    },

    verPost: (id) => {
        return apiRequest(`/api/posts/${id}`, {
            method: 'GET'
        });
    },

    crearPost: (formData) => {
        return apiRequest('/api/posts', {
            method: 'POST',
            body: formData // Envío directo de FormData para subir archivos
        });
    },

    editarPost: (id, formData) => {
        return apiRequest(`/api/posts/${id}`, {
            method: 'PUT',
            body: formData
        });
    },

    eliminarPost: (id) => {
        return apiRequest(`/api/posts/${id}`, {
            method: 'DELETE'
        });
    },

    // Comentarios
    crearComentario: (postId, formData) => {
        return apiRequest(`/api/posts/${postId}/comentarios`, {
            method: 'POST',
            body: formData
        });
    },

    eliminarComentario: (id) => {
        return apiRequest(`/api/comentarios/${id}`, {
            method: 'DELETE'
        });
    },

    // Perfil de Usuario
    verPerfil: () => {
        return apiRequest('/api/users/me', {
            method: 'GET'
        });
    },

    editarPerfil: (formData) => {
        return apiRequest('/api/users/me', {
            method: 'PUT',
            body: formData
        });
    }
};
