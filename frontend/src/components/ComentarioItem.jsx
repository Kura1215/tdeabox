import { API_URL } from '../api';
import { DEFAULT_AVATAR, formatearFecha } from '../utils';
import { useAuth } from '../context/AuthContext';

export default function ComentarioItem({ comentario, onEliminar }) {
    const { usuario } = useAuth();
    const avatarSrc = comentario.fotoPerfilUsuario ? `${API_URL}${comentario.fotoPerfilUsuario}` : DEFAULT_AVATAR;
    const esAutor = usuario && String(usuario.usuarioId) === String(comentario.usuarioId);

    return (
        <div className="comentario-item">
            <div className="comentario-meta">
                <div>
                    <img src={avatarSrc} alt="Avatar" className="comentario-avatar" />
                    <strong className="comentario-autor">{comentario.nombreUsuario || comentario.usernameUsuario}</strong>
                    <span style={{ color: 'var(--gris-medio)' }}> (@{comentario.usernameUsuario}) · {formatearFecha(comentario.fechaCreacion)}</span>
                </div>
                <div>
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
