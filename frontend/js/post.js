// Referencias a los elementos del DOM
const sidebarAvatar = document.getElementById('sidebar-avatar');
const sidebarNombre = document.getElementById('sidebar-nombre');
const sidebarUsername = document.getElementById('sidebar-username');
const postDetailContainer = document.getElementById('post-detail-container');
const commentsList = document.getElementById('comments-list');
const commentForm = document.getElementById('comment-form');
const commentText = document.getElementById('comment-text');
const commentImage = document.getElementById('comment-image');
const postAlert = document.getElementById('post-alert');

// Constante para avatar por defecto en SVG
const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231a3a5c'/><circle cx='50' cy='35' r='20' fill='%23ffffff'/><path d='M15,85 C15,65 30,55 50,55 C70,55 85,65 85,85 Z' fill='%23ffffff'/></svg>";

// Obtener ID del post de los parámetros de consulta URL
const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get('id');

// Cargar la información del perfil del usuario logueado en la barra lateral
function cargarPerfilSidebar() {
    const usuario = auth.getCurrentUser();
    if (usuario) {
        sidebarNombre.textContent = usuario.nombre;
        sidebarUsername.textContent = `@${usuario.username}`;
        
        if (usuario.fotoPerfil) {
            sidebarAvatar.src = `${API_URL}${usuario.fotoPerfil}`;
        } else {
            sidebarAvatar.src = DEFAULT_AVATAR;
        }
    }
}

// Retorna la clase de estilos CSS según la categoría
function obtenerClaseCategoria(categoriaId) {
    switch (parseInt(categoriaId)) {
        case 1: return 'badge-academico'; // Académico
        case 2: return 'badge-eventos';    // Eventos
        case 3: return 'badge-perdidos';   // Objetos Perdidos
        default: return 'badge-general';    // General / Otros
    }
}

// Cargar el detalle del post y sus comentarios asociados
async function cargarDetallePost() {
    if (!postId) {
        window.location.href = 'feed.html';
        return;
    }

    try {
        const post = await api.verPost(postId);
        renderizarPostDetalle(post);
        renderizarComentarios(post.comentarios || []);
    } catch (error) {
        console.error('Error al cargar detalle del post:', error);
        postDetailContainer.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--rojo); font-family: Arial, sans-serif;">
                No se pudo cargar la publicación o no existe.
            </div>
        `;
        commentsList.innerHTML = '';
        mostrarAlertaPost('No se pudo encontrar la publicación especificada.', false);
    }
}

// Renderizar dinámicamente los datos del post en pantalla
function renderizarPostDetalle(post) {
    postDetailContainer.innerHTML = '';

    // Formatear la fecha
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

    const badgeClass = obtenerClaseCategoria(post.categoriaId);

    // Contenido estructurado de la publicación
    let postHtml = `
        <h2>${escaparHTML(post.titulo)}</h2>
        <div class="post-meta" style="border-bottom: 1px solid var(--gris-claro); padding-bottom: 8px;">
            Publicado por <strong>${escaparHTML(post.nombreUsuario || post.usernameUsuario)}</strong> 
            (@${escaparHTML(post.usernameUsuario)}) el ${fechaStr} 
            en <span class="badge ${badgeClass}">${escaparHTML(post.nombreCategoria)}</span>
        </div>
        <div style="font-size: 14px; line-height: 1.6; margin: 14px 0; white-space: pre-wrap; font-family: Georgia, serif;">${escaparHTML(post.contenido)}</div>
    `;

    // Imagen adjunta si existe
    if (post.imagenUrl) {
        postHtml += `
            <div style="text-align: center; margin-top: 12px;">
                <img src="${API_URL}${post.imagenUrl}" alt="Imagen de la publicación" class="post-img" style="max-height: 450px; object-fit: contain;">
            </div>
        `;
    }

    postDetailContainer.innerHTML = postHtml;
}

// Renderizar la lista de comentarios
function renderizarComentarios(comentarios) {
    commentsList.innerHTML = '';

    if (!comentarios || comentarios.length === 0) {
        commentsList.innerHTML = `
            <p style="text-align: center; color: var(--gris-medio); font-family: Arial, sans-serif; padding: 24px;">
                No hay comentarios todavía. ¡Sé el primero en responder!
            </p>
        `;
        return;
    }

    const currentUser = auth.getCurrentUser();

    comentarios.forEach(com => {
        const item = document.createElement('div');
        item.className = 'comentario-item';

        // Formatear la fecha del comentario
        let fechaStr = 'Fecha desconocida';
        if (com.fechaCreacion) {
            const fecha = new Date(com.fechaCreacion);
            fechaStr = fecha.toLocaleString('es-CO', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        // Determinar avatar del comentarista
        let avatarSrc = DEFAULT_AVATAR;
        if (com.fotoPerfilUsuario) {
            avatarSrc = `${API_URL}${com.fotoPerfilUsuario}`;
        }

        // Comprobación de autoría para mostrar el botón de eliminar
        const esAutor = currentUser && String(currentUser.usuarioId) === String(com.usuarioId);
        
        let botonEliminar = '';
        if (esAutor) {
            botonEliminar = `
                <button class="btn btn-danger btn-sm btn-eliminar-comentario" data-id="${com.id}">
                    Eliminar
                </button>
            `;
        }

        let comentarioHtml = `
            <div class="comentario-meta">
                <div>
                    <img src="${avatarSrc}" alt="Avatar" class="comentario-avatar">
                    <strong class="comentario-autor">${escaparHTML(com.nombreUsuario || com.usernameUsuario)}</strong>
                    <span style="color: var(--gris-medio);">(@${escaparHTML(com.usernameUsuario)}) · ${fechaStr}</span>
                </div>
                <div>
                    ${botonEliminar}
                </div>
            </div>
            <div style="font-size: 13px; line-height: 1.4; padding-left: 40px; font-family: Arial, sans-serif; white-space: pre-wrap;">${escaparHTML(com.contenido)}</div>
        `;

        // Si tiene imagen de comentario
        if (com.imagenUrl) {
            comentarioHtml += `
                <div style="padding-left: 40px; margin-top: 8px;">
                    <img src="${API_URL}${com.imagenUrl}" alt="Imagen del comentario" class="post-img" style="max-height: 180px; object-fit: contain;">
                </div>
            `;
        }

        item.innerHTML = comentarioHtml;
        commentsList.appendChild(item);
    });

    // Configurar controladores de eventos para los botones de eliminación de comentarios
    configurarEventosEliminarComentarios();
}

// Configurar los botones de eliminar comentarios
function configurarEventosEliminarComentarios() {
    const botones = commentsList.querySelectorAll('.btn-eliminar-comentario');
    botones.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const comentarioId = btn.dataset.id;
            
            if (confirm('¿Estás seguro de que deseas eliminar este comentario?')) {
                try {
                    ocultarAlertaPost();
                    await api.eliminarComentario(comentarioId);
                    mostrarAlertaPost('Comentario eliminado correctamente.', true);
                    // Recargar el detalle y comentarios
                    await cargarDetallePost();
                } catch (error) {
                    mostrarAlertaPost(error.message || 'No se pudo eliminar el comentario.', false);
                }
            }
        });
    });
}

// Manejar el envío del formulario para crear un comentario
commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarAlertaPost();

    const contenido = commentText.value.trim();
    if (!contenido) {
        mostrarAlertaPost('Por favor, escribe un comentario.', false);
        return;
    }

    // Usar FormData para adjuntar opcionalmente la imagen física
    const formData = new FormData();
    formData.append('contenido', contenido);
    
    if (commentImage.files && commentImage.files[0]) {
        formData.append('imagen', commentImage.files[0]);
    }

    try {
        const btnSubmit = document.getElementById('btn-comment-submit');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Enviando...';

        await api.crearComentario(postId, formData);
        
        mostrarAlertaPost('Comentario enviado correctamente.', true);
        
        // Resetear formulario
        commentForm.reset();
        
        // Recargar el hilo de comentarios
        await cargarDetallePost();
        
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Enviar Comentario';
    } catch (error) {
        mostrarAlertaPost(error.message || 'No se pudo enviar el comentario.', false);
        const btnSubmit = document.getElementById('btn-comment-submit');
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Enviar Comentario';
    }
});

// Función auxiliar para escapar texto y evitar problemas de XSS
function escaparHTML(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

// Mostrar alertas de la página
function mostrarAlertaPost(mensaje, esExito = false) {
    postAlert.textContent = mensaje;
    postAlert.style.display = 'block';
    if (esExito) {
        postAlert.className = 'alerta alerta-ok';
    } else {
        postAlert.className = 'alerta alerta-error';
    }
}

// Ocultar alertas de la página
function ocultarAlertaPost() {
    postAlert.style.display = 'none';
    postAlert.textContent = '';
}

// Configurar botón de Cerrar Sesión del Navbar
const navLogout = document.getElementById('nav-link-logout');
if (navLogout) {
    navLogout.addEventListener('click', (e) => {
        e.preventDefault();
        auth.logout();
    });
}

// Inicialización de la Página
document.addEventListener('DOMContentLoaded', () => {
    cargarPerfilSidebar();
    cargarDetallePost();
});
