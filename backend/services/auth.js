// Registro, login y sesiones.
//
// Cada inicio de sesion crea una fila en `sesiones` y entrega dos cosas:
//  1. token: JWT de 15 min que el frontend guarda SOLO en memoria y manda en "Authorization: Bearer".
//  2. tokenRenovacion: valor aleatorio que viaja en una cookie HttpOnly (JavaScript no la puede leer).
//     Con ella el frontend pide un JWT nuevo (/api/auth/renovar) cuando el anterior vence.
// Cerrar sesion borra la fila: la cookie y los JWT de esa sesion dejan de servir (revocacion).
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { Usuario, Sesion } = require('../models');
const { generarToken } = require('../config/jwt');
const { ErrorHttp, errorMysql } = require('../utils/errores');

const DIAS_SESION = Number(process.env.SESION_DIAS) || 7;

// hash de relleno para que login tarde igual exista o no el correo (evita enumerar usuarios por tiempo)
const HASH_FALSO = bcrypt.hashSync('relleno-contra-timing', 10);

// en la BD solo se guarda el hash del token de renovacion: quien lea la tabla no puede usarlo
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// misma forma para registro, login y renovar
function respuestaSesion(u, sesionId) {
    return {
        exito: true,
        token: generarToken(u.id, sesionId),
        usuarioId: u.id,
        nombre: u.nombre,
        username: u.username,
        fotoPerfil: u.foto_perfil || '',
        rol: u.rol || 'usuario'
    };
}

// Crea la sesion en la BD; devuelve { datos, tokenRenovacion, expira }
async function abrirSesion(usuario) {
    // de paso borra las sesiones vencidas de este usuario
    await Sesion.destroy({ where: { usuario_id: usuario.id, expira: { [Op.lt]: new Date() } } });

    const tokenRenovacion = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000);
    const sesion = await Sesion.create({ usuario_id: usuario.id, token_hash: hashToken(tokenRenovacion), expira });
    return { datos: respuestaSesion(usuario, sesion.id), tokenRenovacion, expira };
}

async function registrar({ nombre, username, correo, password, fotoPerfil }) {
    // la BD tiene UNIQUE en correo y username: es la que decide en caso de carrera
    const passwordHash = await bcrypt.hash(password, 10);
    let usuario;
    try {
        usuario = await Usuario.create({ nombre, username, correo, password_hash: passwordHash, foto_perfil: fotoPerfil });
    } catch (error) {
        const mysql = errorMysql(error);
        if (mysql.code === 'ER_DUP_ENTRY') {
            throw new ErrorHttp(409, /correo/i.test(mysql.sqlMessage) ? 'El correo ya está registrado' : 'El username ya está en uso');
        }
        throw error;
    }
    usuario.rol = 'usuario';
    return abrirSesion(usuario);
}

async function iniciarSesion(correo, password) {
    const usuario = await Usuario.findOne({ where: { correo } });
    const coincide = await bcrypt.compare(password, usuario ? usuario.password_hash : HASH_FALSO);
    if (!usuario || !coincide) throw new ErrorHttp(401, 'Credenciales incorrectas');
    return abrirSesion(usuario);
}

// Busca la sesion vigente de una cookie de renovacion
function buscarSesion(tokenRenovacion) {
    return Sesion.findOne({
        where: { token_hash: hashToken(tokenRenovacion), expira: { [Op.gt]: new Date() } },
        include: [{ model: Usuario, as: 'usuario' }]
    });
}

// Entrega un JWT nuevo si la cookie corresponde a una sesion vigente
async function renovar(tokenRenovacion) {
    const sesion = tokenRenovacion ? await buscarSesion(tokenRenovacion) : null;
    if (!sesion) throw new ErrorHttp(401, 'Tu sesion ha expirado. Inicia sesion nuevamente.');
    return respuestaSesion(sesion.usuario, sesion.id);
}

async function cerrarSesion(tokenRenovacion) {
    if (tokenRenovacion) await Sesion.destroy({ where: { token_hash: hashToken(tokenRenovacion) } });
}

// Para el middleware: usuario { id, correo, rol } de un JWT valido, solo si su sesion sigue abierta.
// Leer el rol de la BD (y no del token) permite que quitar el admin o borrar un usuario surta efecto de inmediato.
async function usuarioDeSesion(sesionId, usuarioId) {
    const sesion = await Sesion.findOne({
        where: { id: sesionId, usuario_id: usuarioId, expira: { [Op.gt]: new Date() } },
        include: [{ model: Usuario, as: 'usuario', attributes: ['id', 'correo', 'rol'] }]
    });
    return sesion ? sesion.usuario.get({ plain: true }) : null;
}

module.exports = { registrar, iniciarSesion, renovar, cerrarSesion, usuarioDeSesion };
