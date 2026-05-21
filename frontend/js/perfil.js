// Referencias a los elementos del DOM
const sidebarAvatar = document.getElementById('sidebar-avatar');
const sidebarNombre = document.getElementById('sidebar-nombre');
const sidebarUsername = document.getElementById('sidebar-username');
const profileAlert = document.getElementById('profile-alert');
const profileForm = document.getElementById('profile-form');

const profileName = document.getElementById('profile-name');
const profileUsername = document.getElementById('profile-username');
const profileEmail = document.getElementById('profile-email');
const profileAvatar = document.getElementById('profile-avatar');
const btnSaveProfile = document.getElementById('btn-save-profile');

const userPostsContainer = document.getElementById('user-posts-container');

// Avatar por defecto en SVG (offline/independiente)
const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231a3a5c'/><circle cx='50' cy='35' r='20' fill='%23ffffff'/><path d='M15,85 C15,65 30,55 50,55 C70,55 85,65 85,85 Z' fill='%23ffffff'/></svg>";

// Retorna la clase de estilos CSS según la categoría
function obtenerClaseCategoria(categoriaId) {
    switch (parseInt(categoriaId)) {
        case 1: return 'badge-academico'; // Académico
        case 2: return 'badge-eventos';    // Eventos
        case 3: return 'badge-perdidos';   // Objetos Perdidos
        default: return 'badge-general';    // General / Otros
    }
}

// Escapar texto para prevenir XSS
function escaparHTML(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

// Mostrar alertas informativas en pantalla
function mostrarAlerta(mensaje, esExito = false) {
    profileAlert.textContent = mensaje;
    profileAlert.style.display = 'block';
    if (esExito) {
        profileAlert.className = 'alerta alerta-ok';
    } else {
        profileAlert.className = 'alerta alerta-error';
    }
}

// Ocultar alerta de pantalla
function ocultarAlerta() {
    profileAlert.style.display = 'none';
    profileAlert.textContent = '';
}

// Cargar la información completa del perfil del usuario y su listado de publicaciones
async function cargarPerfilCompleto() {
    ocultarAlerta();
    try {
        const data = await api.verPerfil();

        // 1. Cargar datos en la barra lateral
        sidebarNombre.textContent = data.nombre;
        sidebarUsername.textContent = `@${data.username}`;
        if (data.fotoPerfil) {
            sidebarAvatar.src = `${API_URL}${data.fotoPerfil}`;
        } else {
            sidebarAvatar.src = DEFAULT_AVATAR;
        }

        // 2. Cargar datos en el formulario de edición
        profileName.value = data.nombre;
        profileUsername.value = data.username;
        profileEmail.value = data.correo;

        // 3. Sincronizar datos con localStorage para mantener sidebar de otras páginas actualizadas
        localStorage.setItem('nombre', data.nombre);
        localStorage.setItem('fotoPerfil', data.fotoPerfil || '');

        // 4. Renderizar el historial de publicaciones creadas por el usuario
        renderizarPublicacionesPropias(data.posts);

    } catch (error) {
        console.error('Error al cargar datos del perfil:', error);
        mostrarAlerta('No se pudieron obtener los datos de tu cuenta desde el servidor.', false);
    }
}

// Renderizar el listado de posts propios en la sección central inferior
function renderizarPublicacionesPropias(posts) {
    userPostsContainer.innerHTML = '';

    if (!posts || posts.length === 0) {
        userPostsContainer.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--gris-medio); font-family: Arial, sans-serif;">
                No has realizado publicaciones en el foro todavía.
            </div>
        `;
        return;
    }

    posts.forEach(post => {
        const card = document.createElement('article');
        card.className = 'post-card';

        // Formatear la fecha de creación
        let fechaStr = 'Fecha desconocida';
        if (post.fechaCreacion) {
            const fecha = new Date(post.fechaCreacion);
            fechaStr = fecha.toLocaleString('es-CO', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        // Determinar insignia de categoría
        const badgeClass = obtenerClaseCategoria(post.categoriaId);

        // Recortar texto para previsualización (máx 150 caracteres)
        const limiteSnippet = 150;
        let snippet = post.contenido;
        if (snippet.length > limiteSnippet) {
            snippet = snippet.substring(0, limiteSnippet) + '...';
        }

        let cardHtml = `
            <h3><a href="post.html?id=${post.id}">${escaparHTML(post.titulo)}</a></h3>
            <div class="post-historial-meta">
                <div>
                    Publicado el ${fechaStr} en <span class="badge ${badgeClass}">${escaparHTML(post.nombreCategoria)}</span>
                </div>
                <div>
                    <button class="btn btn-danger btn-sm btn-delete-post" data-id="${post.id}">
                        Eliminar Publicación
                    </button>
                </div>
            </div>
            <p style="font-size: 12px; color: var(--texto); line-height: 1.4; margin-bottom: 4px;">${escaparHTML(snippet)}</p>
        `;

        if (post.imagenUrl) {
            cardHtml += `
                <div>
                    <img src="${API_URL}${post.imagenUrl}" alt="Imagen del post" class="post-img" style="max-height: 120px; object-fit: cover; margin-bottom: 6px;">
                </div>
            `;
        }

        card.innerHTML = cardHtml;
        userPostsContainer.appendChild(card);
    });

    // Configurar controladores de eventos para los botones de eliminación de posts
    configurarEventosEliminar();
}

// Configurar los manejadores de eventos clic para los botones de borrado de posts
function configurarEventosEliminar() {
    const botones = userPostsContainer.querySelectorAll('.btn-delete-post');
    botones.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const postId = btn.dataset.id;
            
            const confirmar = confirm('¿Estás seguro de que deseas eliminar esta publicación permanentemente? Esta acción borrará todas sus respuestas asociadas.');
            if (confirmar) {
                try {
                    await api.eliminarPost(postId);
                    mostrarAlerta('¡Publicación eliminada correctamente!', true);
                    
                    // Recargar el perfil completo
                    await cargarPerfilCompleto();
                } catch (error) {
                    console.error('Error al eliminar post:', error);
                    mostrarAlerta(error.message || 'Error al intentar eliminar la publicación del servidor.', false);
                }
            }
        });
    });
}

// Manejar el envío del formulario para actualizar el nombre y/o foto de perfil
profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarAlerta();

    const nombreVal = profileName.value.trim();

    if (!nombreVal) {
        mostrarAlerta('El nombre completo no puede estar vacío.', false);
        return;
    }

    const formData = new FormData();
    formData.append('nombre', nombreVal);

    if (profileAvatar.files.length > 0) {
        formData.append('foto', profileAvatar.files[0]);
    }

    try {
        btnSaveProfile.disabled = true;
        btnSaveProfile.textContent = 'Guardando...';

        const res = await api.editarPerfil(formData);

        // Actualizar localStorage con la respuesta del backend
        localStorage.setItem('nombre', res.nombre);
        localStorage.setItem('fotoPerfil', res.fotoPerfil || '');

        mostrarAlerta('¡Datos de perfil guardados con éxito!', true);

        // Limpiar el selector de archivo
        profileAvatar.value = '';

        // Recargar datos actualizados en la UI
        await cargarPerfilCompleto();

    } catch (error) {
        console.error('Error al editar perfil:', error);
        mostrarAlerta(error.message || 'Error al intentar actualizar los datos personales.', false);
    } finally {
        btnSaveProfile.disabled = false;
        btnSaveProfile.textContent = 'Guardar Cambios';
    }
});

// Configurar botón de Cerrar Sesión del Navbar
const navLogout = document.getElementById('nav-link-logout');
if (navLogout) {
    navLogout.addEventListener('click', (e) => {
        e.preventDefault();
        auth.logout();
    });
}

// Inicializar la carga cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    cargarPerfilCompleto();
});
