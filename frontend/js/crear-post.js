// Referencias a los elementos del DOM
const sidebarAvatar = document.getElementById('sidebar-avatar');
const sidebarNombre = document.getElementById('sidebar-nombre');
const sidebarUsername = document.getElementById('sidebar-username');
const createPostAlert = document.getElementById('create-post-alert');
const createPostForm = document.getElementById('create-post-form');

const postTitle = document.getElementById('post-title');
const postCategory = document.getElementById('post-category');
const postContent = document.getElementById('post-content');
const postImage = document.getElementById('post-image');
const btnSubmitPost = document.getElementById('btn-submit-post');

// Avatar por defecto en SVG (offline/independiente)
const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231a3a5c'/><circle cx='50' cy='35' r='20' fill='%23ffffff'/><path d='M15,85 C15,65 30,55 50,55 C70,55 85,65 85,85 Z' fill='%23ffffff'/></svg>";

// Cargar información del usuario autenticado en la barra lateral
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

// Cargar dinámicamente las categorías en el selector dropdown
async function cargarCategoriasSelect() {
    try {
        const categorias = await api.listarCategorias();
        
        // Mantener la opción por defecto deshabilitada y agregar las categorías del backend
        postCategory.innerHTML = `<option value="" disabled selected>Selecciona una categoría...</option>`;
        
        categorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.nombre;
            postCategory.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar categorías:', error);
        mostrarAlerta('No se pudieron obtener las categorías desde el servidor.', false);
    }
}

// Mostrar alertas informativas (de éxito o error) en la pantalla
function mostrarAlerta(mensaje, esExito = false) {
    createPostAlert.textContent = mensaje;
    createPostAlert.style.display = 'block';
    if (esExito) {
        createPostAlert.className = 'alerta alerta-ok';
    } else {
        createPostAlert.className = 'alerta alerta-error';
    }
}

// Ocultar alerta de la pantalla
function ocultarAlerta() {
    createPostAlert.style.display = 'none';
    createPostAlert.textContent = '';
}

// Manejar el envío del formulario para crear la publicación
createPostForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarAlerta();

    const tituloVal = postTitle.value.trim();
    const categoriaVal = postCategory.value;
    const contenidoVal = postContent.value.trim();

    // Validaciones locales adicionales en el cliente
    if (!tituloVal || !categoriaVal || !contenidoVal) {
        mostrarAlerta('Por favor, completa todos los campos obligatorios del formulario.', false);
        return;
    }

    // Preparar objeto FormData para soportar carga física de la imagen
    const formData = new FormData();
    formData.append('titulo', tituloVal);
    formData.append('categoriaId', categoriaVal);
    formData.append('contenido', contenidoVal);

    if (postImage.files.length > 0) {
        formData.append('imagen', postImage.files[0]);
    }

    try {
        // Deshabilitar botón para prevenir clics dobles y peticiones en ráfaga
        btnSubmitPost.disabled = true;
        btnSubmitPost.textContent = 'Publicando...';

        await api.crearPost(formData);

        // Desplegar confirmación exitosa con estilo retro
        mostrarAlerta('¡Publicación creada exitosamente! Redirigiendo al feed...', true);
        
        // Limpiar el formulario
        createPostForm.reset();

        // Redirigir al feed principal tras un breve retardo de 1 segundo
        setTimeout(() => {
            window.location.href = 'feed.html';
        }, 1000);

    } catch (error) {
        console.error('Error al crear publicación:', error);
        mostrarAlerta(error.message || 'Error al intentar registrar la publicación.', false);
        btnSubmitPost.disabled = false;
        btnSubmitPost.textContent = 'Publicar en el Foro';
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

// Inicialización cuando el DOM está completamente listo
document.addEventListener('DOMContentLoaded', () => {
    cargarPerfilSidebar();
    cargarCategoriasSelect();
});
