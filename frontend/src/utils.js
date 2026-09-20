// avatar por defecto en svg para cuando el usuario no tiene foto
export const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231a3a5c'/><circle cx='50' cy='35' r='20' fill='%23ffffff'/><path d='M15,85 C15,65 30,55 50,55 C70,55 85,65 85,85 Z' fill='%23ffffff'/></svg>";

export function obtenerClaseCategoria(categoriaId) {
    switch (parseInt(categoriaId)) {
        case 1: return 'badge-academico';
        case 2: return 'badge-eventos';
        case 3: return 'badge-perdidos';
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
