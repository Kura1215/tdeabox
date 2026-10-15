// avatar por defecto en svg para cuando el usuario no tiene foto
export const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231a3a5c'/><circle cx='50' cy='35' r='20' fill='%23ffffff'/><path d='M15,85 C15,65 30,55 50,55 C70,55 85,65 85,85 Z' fill='%23ffffff'/></svg>";

// categorias sembradas: 1 Objetos Perdidos, 2 Academico, 3 Eventos, 4 General
export function obtenerClaseCategoria(categoriaId) {
    switch (parseInt(categoriaId)) {
        case 1: return 'badge-perdidos';
        case 2: return 'badge-academico';
        case 3: return 'badge-eventos';
        default: return 'badge-general';
    }
}

export function formatearFecha(fecha) {
    if (!fecha) return 'Fecha desconocida';
    return new Date(fecha).toLocaleString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ---- modo oscuro: preferencia guardada, o la del sistema si no hay ninguna ----
export function temaInicial() {
    try {
        const guardado = localStorage.getItem('tema');
        if (guardado === 'oscuro' || guardado === 'claro') return guardado;
    } catch (e) {
        // localStorage no disponible: seguimos con la preferencia del sistema
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

export function aplicarTema(tema) {
    document.documentElement.setAttribute('data-tema', tema);
    try {
        localStorage.setItem('tema', tema);
    } catch (e) {
        // sin persistencia, el tema aplica solo en esta sesion
    }
}
