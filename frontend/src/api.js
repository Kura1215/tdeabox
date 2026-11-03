export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// El token de acceso (dura 15 min) se guarda SOLO en memoria, no en localStorage: un script
// inyectado (XSS) no lo encuentra guardado y, si lo robara, venceria pronto.
// La sesion larga vive en una cookie HttpOnly que JavaScript no puede leer; el navegador
// la envia sola a /api/auth/renovar para pedir un token nuevo.
let tokenAcceso = null;

export function guardarToken(token) {
    tokenAcceso = token;
}

// header que el backend exige en renovar/logout (proteccion CSRF)
const HEADER_CSRF = { 'X-Requested-With': 'TdeaVox' };

// Pide un token nuevo con la cookie y devuelve los datos de la sesion.
// Si varias peticiones lo necesitan a la vez, todas esperan la misma llamada.
let renovando = null;
export function renovarSesion() {
    if (!renovando) {
        renovando = fetch(`${API_URL}/api/auth/renovar`, { method: 'POST', credentials: 'include', headers: HEADER_CSRF })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Tu sesion ha expirado');
                tokenAcceso = data.token;
                return data;
            })
            .finally(() => { renovando = null; });
    }
    return renovando;
}

// hace el fetch con el token actual; un fallo de red (TypeError "Failed to fetch") en un GET
// se reintenta una vez: es seguro repetirlo
async function enviar(endpoint, options) {
    const headers = { ...options.headers };
    if (tokenAcceso) headers['Authorization'] = `Bearer ${tokenAcceso}`;
    // credentials: 'include' para que el navegador guarde y envie la cookie de sesion
    const fetchOptions = { ...options, headers, credentials: 'include' };

    const esGet = !options.method || options.method === 'GET';
    try {
        return await fetch(`${API_URL}${endpoint}`, fetchOptions);
    } catch (error) {
        if (esGet) {
            await new Promise((r) => setTimeout(r, 400));
            try {
                return await fetch(`${API_URL}${endpoint}`, fetchOptions);
            } catch (e) {
                // se lanza abajo
            }
        }
        throw new Error('No se pudo conectar con el servidor. Verifica que el backend este encendido.');
    }
}

// funcion auxiliar para hacer las peticiones fetch con el token metido
async function apiRequest(endpoint, options = {}) {
    const headers = options.headers || {};

    // si el body no es FormData le mandamos el content type de json
    const isMultipart = options.body instanceof FormData;
    if (!isMultipart && options.body && typeof options.body === 'object') {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }
    options.headers = headers;

    let response = await enviar(endpoint, options);

    // 401 = el token vencio o la sesion se cerro: se intenta renovar una vez y se repite la peticion
    if (response.status === 401 && !endpoint.includes('/api/auth/')) {
        try {
            await renovarSesion();
            response = await enviar(endpoint, options);
        } catch (error) {
            // la cookie tambien vencio: hay que volver a iniciar sesion
        }
    }

    if (response.status === 401 && !endpoint.includes('/api/auth/')) {
        tokenAcceso = null;
        window.location.href = '/';
        throw new Error('Tu sesion ha expirado. Por favor inicia sesion nuevamente.');
    }

    if (response.status === 204) {
        return null;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || data.mensaje || 'Ocurrio un error en el servidor');
    }

    return data;
}

// arma ?a=1&b=2 ignorando los valores vacios
function queryString(params) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([clave, valor]) => {
        if (valor !== undefined && valor !== null && valor !== '' && valor !== false) q.append(clave, valor);
    });
    const texto = q.toString();
    return texto ? `?${texto}` : '';
}

export const api = {
    login: (correo, password) => {
        return apiRequest('/api/auth/login', {
            method: 'POST',
            body: { correo, password }
        });
    },

    // formData con nombre, username, correo, password y foto opcional
    register: (formData) => {
        return apiRequest('/api/auth/register', {
            method: 'POST',
            body: formData
        });
    },

    // el servidor borra la sesion y la cookie
    logout: () => {
        return apiRequest('/api/auth/logout', { method: 'POST', headers: { ...HEADER_CSRF } });
    },

    listarCategorias: () => {
        return apiRequest('/api/categorias', { method: 'GET' });
    },

    // filtros: { categoria, q, tag, autor, desde, hasta, siguiendo } -> { posts, paginacion }
    listarPosts: (filtros = {}, page = 1, limit = 10) => {
        return apiRequest(`/api/posts${queryString({ ...filtros, page, limit })}`, { method: 'GET' });
    },

    ranking: () => {
        return apiRequest('/api/posts/ranking-semanal', { method: 'GET' });
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

    editarPost: (id, formData) => {
        return apiRequest(`/api/posts/${id}`, {
            method: 'PUT',
            body: formData
        });
    },

    eliminarPost: (id) => {
        return apiRequest(`/api/posts/${id}`, { method: 'DELETE' });
    },

    guardarPost: (id) => {
        return apiRequest(`/api/posts/${id}/guardar`, { method: 'POST' });
    },

    listarComentarios: (postId, page = 1) => {
        return apiRequest(`/api/posts/${postId}/comentarios?page=${page}&limit=20`, { method: 'GET' });
    },

    crearComentario: (postId, formData) => {
        return apiRequest(`/api/posts/${postId}/comentarios`, {
            method: 'POST',
            body: formData
        });
    },

    responderComentario: (comentarioId, formData) => {
        return apiRequest(`/api/comentarios/${comentarioId}/respuestas`, {
            method: 'POST',
            body: formData
        });
    },

    editarComentario: (id, contenido) => {
        return apiRequest(`/api/comentarios/${id}`, {
            method: 'PUT',
            body: { contenido }
        });
    },

    eliminarComentario: (id) => {
        return apiRequest(`/api/comentarios/${id}`, { method: 'DELETE' });
    },

    sesion: () => {
        return apiRequest('/api/users/me/sesion', { method: 'GET' });
    },

    verPerfil: (page = 1) => {
        return apiRequest(`/api/users/me?page=${page}`, { method: 'GET' });
    },

    editarPerfil: (formData) => {
        return apiRequest('/api/users/me', {
            method: 'PUT',
            body: formData
        });
    },

    verUsuario: (id, page = 1) => {
        return apiRequest(`/api/users/${id}?page=${page}`, { method: 'GET' });
    },

    guardados: (page = 1) => {
        return apiRequest(`/api/users/me/guardados?page=${page}`, { method: 'GET' });
    },

    // alterna el seguimiento y devuelve { siguiendo, seguidores }
    seguir: (id) => {
        return apiRequest(`/api/users/${id}/seguir`, { method: 'POST' });
    },

    seguidores: (id) => {
        return apiRequest(`/api/users/${id}/seguidores?limit=50`, { method: 'GET' });
    },

    seguidos: (id) => {
        return apiRequest(`/api/users/${id}/seguidos?limit=50`, { method: 'GET' });
    },

    // alterna el like y devuelve { likes, likedByMe }
    likePost: (id) => {
        return apiRequest(`/api/posts/${id}/like`, { method: 'POST' });
    },

    likeComentario: (id) => {
        return apiRequest(`/api/comentarios/${id}/like`, { method: 'POST' });
    },

    notificaciones: (page = 1) => {
        return apiRequest(`/api/notificaciones?page=${page}&limit=20`, { method: 'GET' });
    },

    contarNoLeidas: () => {
        return apiRequest('/api/notificaciones?limit=1', { method: 'GET' });
    },

    marcarNotificacion: (id, leido) => {
        return apiRequest(`/api/notificaciones/${id}`, { method: 'PATCH', body: { leido } });
    },

    marcarTodasLeidas: () => {
        return apiRequest('/api/notificaciones/leer-todas', { method: 'POST' });
    },

    // tipo: 'post' | 'comentario'; motivo: spam | contenido_inapropiado | otro
    reportar: (tipo, id, motivo, descripcion) => {
        return apiRequest('/api/reportes', {
            method: 'POST',
            body: { tipo, id, motivo, descripcion }
        });
    },

    adminReportes: (estado = '', page = 1) => {
        return apiRequest(`/api/admin/reportes${queryString({ estado, page })}`, { method: 'GET' });
    },

    adminResolverReporte: (id, estado, eliminarContenido = false) => {
        return apiRequest(`/api/admin/reportes/${id}`, {
            method: 'PATCH',
            body: { estado, eliminarContenido }
        });
    },

    adminAuditoria: (page = 1) => {
        return apiRequest(`/api/admin/auditoria?page=${page}`, { method: 'GET' });
    }
};
