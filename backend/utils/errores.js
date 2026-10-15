// Error con codigo HTTP; el middleware de errores lo convierte en respuesta JSON
class ErrorHttp extends Error {
    constructor(status, mensaje) {
        super(mensaje);
        this.status = status;
    }
}

// Envuelve un handler async para que cualquier error llegue al middleware de errores
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Intenta la operacion y, si choca con una restriccion UNIQUE (ER_DUP_ENTRY), devuelve valorSiDuplicado
async function ignorarDuplicado(operacion, valorSiDuplicado = false) {
    try {
        return await operacion();
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return valorSiDuplicado;
        throw error;
    }
}

// MySQL aborta una de dos operaciones que se pisan (deadlock) y pide reintentar; los toggles
// concurrentes (like, seguir, guardar) los provocan, asi que se repite la operacion unas veces.
async function reintentarDeadlock(operacion, intentos = 5) {
    for (let intento = 1; ; intento++) {
        try {
            return await operacion();
        } catch (error) {
            if (error.code !== 'ER_LOCK_DEADLOCK' || intento >= intentos) throw error;
        }
    }
}

module.exports = { ErrorHttp, asyncHandler, ignorarDuplicado, reintentarDeadlock };
