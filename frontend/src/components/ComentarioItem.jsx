import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API_URL } from '../api';
import { DEFAULT_AVATAR, formatearFecha } from '../utils';
import { useAuth } from '../context/AuthContext';

export default function ComentarioItem({ comentario, onEliminar }) {
    const { usuario } = useAuth();
    const [likes, setLikes] = useState(api.likesComentario(comentario.id));
    const avatarSrc = comentario.fotoPerfilUsuario ? `${API_URL}${comentario.fotoPerfilUsuario}` : DEFAULT_AVATAR;
    const esAutor = usuario && String(usuario.usuarioId) === String(comentario.usuarioId);

    return (
        <div className="comentario-item">
            <div className="comentario-meta">
                <div>
                    <img src={avatarSrc} alt="Avatar" className="comentario-avatar" />
                    <Link to={`/usuario/${comentario.usuarioId}`}
                        state={{ nombre: comentario.nombreUsuario, username: comentario.usernameUsuario, fotoPerfil: comentario.fotoPerfilUsuario }}>
                        <strong className="comentario-autor">{comentario.nombreUsuario || comentario.usernameUsuario}</strong>
                    </Link>
                    <span style={{ color: 'var(--gris-medio)' }}> (@{comentario.usernameUsuario}) · {formatearFecha(comentario.fechaCreacion)}</span>
                </div>
                <div>
                    <button className={`btn btn-sm ${likes.likedByMe ? 'btn-primary' : ''}`} style={{ marginRight: '6px' }}
                        onClick={() => setLikes(api.toggleLikeComentario(comentario.id))}>
                        ♥ {likes.total}
                    </button>
                    {esAutor && (
                        <button className="btn btn-danger btn-sm" onClick={() => onEliminar(comentario.id)}>
                            Eliminar
                        </button>
                    )}
                </div>
            </div>

            <div style={{ fontSize: '13px', lineHeight: 1.4, paddingLeft: '40px', fontFamily: 'Arial, sans-serif', whiteSpace: 'pre-wrap' }}>
                {comentario.contenido}
            </div>

            {comentario.imagenUrl && (
                <div style={{ paddingLeft: '40px', marginTop: '8px' }}>
                    <img src={`${API_URL}${comentario.imagenUrl}`} alt="Imagen del comentario" className="post-img" style={{ maxHeight: '180px', objectFit: 'contain' }} />
                </div>
            )}
        </div>
    );
}
