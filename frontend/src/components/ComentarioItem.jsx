import { useState } from 'react';
import { api, API_URL } from '../api';
import { DEFAULT_AVATAR, formatearFecha } from '../utils';
import { useAuth } from '../context/AuthContext';
import AutorPost from './AutorPost';
import Reportar from './Reportar';

// Un comentario con su like, edicion, reporte y (si es raiz) sus respuestas de un solo nivel
export default function ComentarioItem({ comentario, onEliminar, onCambio, esRespuesta = false }) {
    const { usuario } = useAuth();
    const [likes, setLikes] = useState({ likes: comentario.likes, likedByMe: comentario.likedByMe });
    const [editando, setEditando] = useState(false);
    const [textoEdicion, setTextoEdicion] = useState(comentario.contenido);
    const [respondiendo, setRespondiendo] = useState(false);
    const [textoRespuesta, setTextoRespuesta] = useState('');
    const [error, setError] = useState('');

    const avatarSrc = comentario.fotoPerfilUsuario ? `${API_URL}${comentario.fotoPerfilUsuario}` : DEFAULT_AVATAR;
    const puedeEliminar = comentario.esMio || usuario?.rol === 'admin';

    async function guardarEdicion(e) {
        e.preventDefault();
        try {
            await api.editarComentario(comentario.id, textoEdicion.trim());
            setEditando(false);
            setError('');
            onCambio();
        } catch (err) {
            setError(err.message);
        }
    }

    async function enviarRespuesta(e) {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append('contenido', textoRespuesta.trim());
            await api.responderComentario(comentario.id, formData);
            setTextoRespuesta('');
            setRespondiendo(false);
            setError('');
            onCambio();
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div className={esRespuesta ? 'comentario-item comentario-respuesta' : 'comentario-item'}>
            <div className="comentario-meta">
                <div>
                    <img src={avatarSrc} alt="Avatar" className="comentario-avatar" />
                    <span className="comentario-autor"><AutorPost item={comentario} /></span>
                    <span style={{ color: 'var(--gris-medio)' }}> · {formatearFecha(comentario.fechaCreacion)}</span>
                    {comentario.editado && <span className="marca-editado"> · editado</span>}
                </div>
                <div>
                    <button className={`btn btn-sm ${likes.likedByMe ? 'btn-primary' : 'btn-secundario'}`} style={{ marginRight: '6px' }}
                        onClick={() => api.likeComentario(comentario.id).then(setLikes).catch(() => {})}>
                        ♥ {likes.likes}
                    </button>
                    {!esRespuesta && usuario && (
                        <button className="btn btn-sm btn-secundario" style={{ marginRight: '6px' }} onClick={() => setRespondiendo(!respondiendo)}>
                            Responder
                        </button>
                    )}
                    {comentario.esMio && (
                        <button className="btn btn-sm btn-secundario" style={{ marginRight: '6px' }} onClick={() => setEditando(!editando)}>
                            Editar
                        </button>
                    )}
                    {puedeEliminar && (
                        <button className="btn btn-danger btn-sm" onClick={() => onEliminar(comentario.id)}>
                            Eliminar
                        </button>
                    )}
                </div>
            </div>

            {editando ? (
                <form onSubmit={guardarEdicion} style={{ paddingLeft: '40px' }}>
                    <textarea rows="2" maxLength={500} value={textoEdicion} onChange={(e) => setTextoEdicion(e.target.value)} className="area-inline" />
                    <button type="submit" className="btn btn-primary btn-sm">Guardar</button>
                </form>
            ) : (
                <div className="comentario-texto">{comentario.contenido}</div>
            )}

            {comentario.imagenUrl && (
                <div style={{ paddingLeft: '40px', marginTop: '8px' }}>
                    <img src={`${API_URL}${comentario.imagenUrl}`} alt="Imagen del comentario" className="post-img" style={{ maxHeight: '180px', objectFit: 'contain' }} />
                </div>
            )}

            {!comentario.esMio && usuario && (
                <div style={{ paddingLeft: '40px', marginTop: '6px' }}>
                    <Reportar tipo="comentario" id={comentario.id} />
                </div>
            )}

            {error && <div className="texto-error" style={{ paddingLeft: '40px' }}>{error}</div>}

            {respondiendo && (
                <form onSubmit={enviarRespuesta} style={{ paddingLeft: '40px', marginTop: '8px' }}>
                    <textarea rows="2" maxLength={500} placeholder="Escribe tu respuesta..." className="area-inline"
                        value={textoRespuesta} onChange={(e) => setTextoRespuesta(e.target.value)} required />
                    <button type="submit" className="btn btn-primary btn-sm">Responder</button>
                </form>
            )}

            {comentario.respuestas?.length > 0 && (
                <div className="respuestas">
                    {comentario.respuestas.map((r) => (
                        <ComentarioItem key={r.id} comentario={r} onEliminar={onEliminar} onCambio={onCambio} esRespuesta />
                    ))}
                </div>
            )}
        </div>
    );
}
