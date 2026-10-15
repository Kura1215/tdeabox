const { ErrorHttp } = require('./errores');

const REGEX_CORREO = /^[a-z0-9._%+-]+@tdea\.edu\.co$/;
const REGEX_USERNAME = /^[a-zA-Z0-9_]{3,30}$/;
const REGEX_TAG = /^[\p{L}\p{N}_]+$/u;

function error400(mensaje) {
    return new ErrorHttp(400, mensaje);
}

// Valida un texto: lo recorta y revisa que sea string y su longitud
function texto(valor, campo, { max, min = 1, requerido = true } = {}) {
    if (valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '')) {
        if (requerido) throw error400(`${campo} es obligatorio`);
        return null;
    }
    if (typeof valor !== 'string') throw error400(`${campo} no es valido`);
    const limpio = valor.trim();
    if (limpio.length < min) throw error400(`${campo} debe tener al menos ${min} caracteres`);
    if (max && limpio.length > max) throw error400(`${campo} no puede superar ${max} caracteres`);
    return limpio;
}

function correoInstitucional(valor) {
    const correo = texto(valor, 'El correo', { max: 100 }).toLowerCase();
    if (!REGEX_CORREO.test(correo)) throw error400('Solo se permiten correos institucionales @tdea.edu.co');
    return correo;
}

function username(valor) {
    const u = texto(valor, 'El username', { max: 30 });
    if (!REGEX_USERNAME.test(u)) {
        throw error400('El username debe tener 3-30 caracteres: letras, numeros o guion bajo');
    }
    return u;
}

function password(valor) {
    if (typeof valor !== 'string' || valor.length < 8 || valor.length > 20) {
        throw error400('La contraseña debe tener entre 8 y 20 caracteres');
    }
    return valor;
}

// Entero positivo (ids, page, limit)
function entero(valor, campo) {
    const n = Number(valor);
    if (!Number.isInteger(n) || n <= 0) throw error400(`${campo} no es valido`);
    return n;
}

// Acepta un arreglo JSON, un string JSON o una lista separada por comas; rechaza (no recorta) si hay mas de 3
function etiquetas(valor) {
    if (valor === undefined || valor === null || valor === '') return [];
    let lista = valor;
    if (typeof valor === 'string') {
        try {
            lista = valor.trim().startsWith('[') ? JSON.parse(valor) : valor.split(',');
        } catch (e) {
            throw error400('Las etiquetas no tienen un formato valido');
        }
    }
    if (!Array.isArray(lista)) throw error400('Las etiquetas no tienen un formato valido');

    const resultado = [];
    for (const item of lista) {
        if (typeof item !== 'string') throw error400('Las etiquetas no tienen un formato valido');
        const tag = item.trim().replace(/^#/, '').toLowerCase();
        if (tag === '') continue;
        if (tag.length > 30) throw error400('Cada etiqueta puede tener maximo 30 caracteres');
        if (!REGEX_TAG.test(tag)) throw error400('Las etiquetas no pueden tener espacios ni simbolos');
        if (!resultado.includes(tag)) resultado.push(tag);
    }
    if (resultado.length > 3) throw error400('Maximo 3 etiquetas por publicacion');
    return resultado;
}

function booleano(valor) {
    return valor === true || valor === 'true' || valor === '1' || valor === 1 || valor === 'on';
}

// Paginacion del feed: limit entre 1 y maxLimit, page >= 1
function paginacion(query, { porDefecto = 10, maxLimit = 20 } = {}) {
    let page = parseInt(query.page, 10);
    let limit = parseInt(query.limit, 10);
    if (!Number.isInteger(page) || page < 1) page = 1;
    if (!Number.isInteger(limit) || limit < 1) limit = porDefecto;
    if (limit > maxLimit) limit = maxLimit;
    return { page, limit, offset: (page - 1) * limit };
}

module.exports = {
    texto, correoInstitucional, username, password, entero, etiquetas, booleano, paginacion, REGEX_USERNAME
};
