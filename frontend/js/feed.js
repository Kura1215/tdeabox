// Referencias a los elementos del DOM
const sidebarAvatar = document.getElementById('sidebar-avatar');
const sidebarNombre = document.getElementById('sidebar-nombre');
const sidebarUsername = document.getElementById('sidebar-username');
const categoriasList = document.getElementById('categorias-list');
const searchInput = document.getElementById('search-input');
const btnBuscar = document.getElementById('btn-buscar');
const postsContainer = document.getElementById('posts-container');
const feedAlert = document.getElementById('feed-alert');

// Constante para avatar por defecto en SVG (offline/independiente)
const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231a3a5c'/><circle cx='50' cy='35' r='20' fill='%23ffffff'/><path d='M15,85 C15,65 30,55 50,55 C70,55 85,65 85,85 Z' fill='%23ffffff'/></svg>";

// Variables de estado local del feed
let categoriaSeleccionada = ''; // Vacío significa "Todos"

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

// Cargar las categorías en el menú de filtros laterales
async function cargarCategoriasFiltros() {
    try {
        const categorias = await api.listarCategorias();
        
        // Mantener el botón "Todos" y agregar las demás categorías dinámicamente
        categoriasList.innerHTML = `<button class="filtro-btn activo" data-id="">Todos</button>`;
        
        categorias.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'filtro-btn';
            btn.dataset.id = cat.id;
            btn.textContent = cat.nombre;
            categoriasList.appendChild(btn);
        });

        // Configurar los manejadores de eventos para los botones de filtros
        configurarEventosFiltros();
    } catch (error) {
        console.error('Error al cargar categorías:', error);
        mostrarAlertaFeed('No se pudieron cargar las categorías del foro.', false);
    }
}

// Configurar los eventos de clic de los botones del menú de categorías
function configurarEventosFiltros() {
    const botones = categoriasList.querySelectorAll('.filtro-btn');
    botones.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Alternar clase activa visualmente
            botones.forEach(b => b.classList.remove('activo'));
            btn.classList.add('activo');

            // Actualizar la categoría seleccionada
            categoriaSeleccionada = btn.dataset.id;
            
            // Limpiar campo de búsqueda al cambiar de categoría
            searchInput.value = '';
            
            // Recargar publicaciones
            await cargarPublicaciones();
        });
    });
}

// Cargar y pintar las publicaciones (posts) en el contenedor principal
async function cargarPublicaciones(busqueda = '') {
    postsContainer.innerHTML = '<p style="text-align: center; color: var(--gris-medio); font-family: Arial, sans-serif; padding: 20px;">Cargando publicaciones...</p>';
    ocultarAlertaFeed();

    try {
        const posts = await api.listarPosts(categoriaSeleccionada, busqueda);
        renderizarPublicaciones(posts);
    } catch (error) {
        postsContainer.innerHTML = '';
        mostrarAlertaFeed('No se pudieron obtener las publicaciones del servidor.', false);
    }
}

// Renderizar dinámicamente la lista de tarjetas de posts
function renderizarPublicaciones(posts) {
    postsContainer.innerHTML = '';

    if (!posts || posts.length === 0) {
        postsContainer.innerHTML = `
            <div class="box" style="padding: 20px; text-align: center; color: var(--gris-medio); font-family: Arial, sans-serif;">
                No hay publicaciones registradas para mostrar.
            </div>
        `;
        return;
    }

    posts.forEach(post => {
        const card = document.createElement('article');
        card.className = 'post-card';

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

        // Determinar estilo de la insignia de la categoría
        const badgeClass = obtenerClaseCategoria(post.categoriaId);

        // Recortar texto para el snippet de previsualización (máx 200 caracteres)
        const limiteSnippet = 200;
        let snippet = post.contenido;
        if (snippet.length > limiteSnippet) {
            snippet = snippet.substring(0, limiteSnippet) + '...';
        }

        // Crear la estructura de la tarjeta
        let postHtml = `
            <h3><a href="post.html?id=${post.id}">${escaparHTML(post.titulo)}</a></h3>
            <div class="post-meta">
                Publicado por <strong>${escaparHTML(post.nombreUsuario || post.usernameUsuario)}</strong> 
                (@${escaparHTML(post.usernameUsuario)}) el ${fechaStr} 
                en <span class="badge ${badgeClass}">${escaparHTML(post.nombreCategoria)}</span>
            </div>
            <p style="font-size: 13px; line-height: 1.5; margin-bottom: 8px;">${escaparHTML(snippet)}</p>
        `;

        // Si tiene imagen adjunta, la pintamos
        if (post.imagenUrl) {
            postHtml += `
                <div>
                    <img src="${API_URL}${post.imagenUrl}" alt="Imagen del post" class="post-img" style="max-height: 250px; object-fit: cover;">
                </div>
            `;
        }

        // Botón de interactividad (Ver detalle y comentarios)
        postHtml += `
            <div style="margin-top: 10px; text-align: right;">
                <a href="post.html?id=${post.id}" class="btn btn-primary btn-sm">Ver Publicidad / Comentar</a>
            </div>
        `;

        card.innerHTML = postHtml;
        postsContainer.appendChild(card);
    });
}

// Función auxiliar para escapar texto y evitar problemas de XSS
function escaparHTML(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

// Mostrar alertas del feed
function mostrarAlertaFeed(mensaje, esExito = false) {
    feedAlert.textContent = mensaje;
    feedAlert.style.display = 'block';
    if (esExito) {
        feedAlert.className = 'alerta alerta-ok';
    } else {
        feedAlert.className = 'alerta alerta-error';
    }
}

// Ocultar alertas del feed
function ocultarAlertaFeed() {
    feedAlert.style.display = 'none';
    feedAlert.textContent = '';
}

// Configurar buscador
btnBuscar.addEventListener('click', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    cargarPublicaciones(query);
});

// Permitir presionar "Enter" para buscar
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchInput.value.trim();
        cargarPublicaciones(query);
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

// Inicialización de la Página
document.addEventListener('DOMContentLoaded', () => {
    cargarPerfilSidebar();
    cargarCategoriasFiltros();
    cargarPublicaciones();
});
