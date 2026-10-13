import { Link } from 'react-router-dom';
import { API_URL } from '../api';
import { obtenerClaseCategoria, formatearFecha } from '../utils';

const LIMITE_SNIPPET = 200;

// tarjeta de un post para las listas del feed y del perfil
export default function PostCard({ post, onEliminar }) {
    const badgeClass = obtenerClaseCategoria(post.categoriaId);

    let snippet = post.contenido;
    if (snippet.length > LIMITE_SNIPPET) {
        snippet = snippet.substring(0, LIMITE_SNIPPET) + '...';
    }

    return (
        <article className="post-card">
            <h3><Link to={`/post/${post.id}`}>{post.titulo}</Link></h3>

            <div className={onEliminar ? 'post-historial-meta' : 'post-meta'}>
                <div>
                    {!onEliminar && (
                        <>Publicado por{' '}
                            <Link to={`/usuario/${post.usuarioId}`}
                                state={{ nombre: post.nombreUsuario, username: post.usernameUsuario, fotoPerfil: post.fotoPerfilUsuario }}>
                                <strong>{post.nombreUsuario || post.usernameUsuario}</strong>
                            </Link> (@{post.usernameUsuario}) el {formatearFecha(post.fechaCreacion)} en </>
                    )}
                    {onEliminar && <>Publicado el {formatearFecha(post.fechaCreacion)} en </>}
                    <span className={`badge ${badgeClass}`}>{post.nombreCategoria}</span>
                </div>
                {onEliminar && (
                    <button className="btn btn-danger btn-sm" onClick={() => onEliminar(post.id)}>
                        Eliminar Publicacion
                    </button>
                )}
            </div>

            <p style={{ fontSize: '13px', lineHeight: 1.5, marginBottom: '8px' }}>{snippet}</p>

            {post.imagenUrl && (
                <div>
                    <img src={`${API_URL}${post.imagenUrl}`} alt="Imagen del post" className="post-img" style={{ maxHeight: '250px', objectFit: 'cover' }} />
                </div>
            )}

            {!onEliminar && (
                <div style={{ marginTop: '10px', textAlign: 'right' }}>
                    <Link to={`/post/${post.id}`} className="btn btn-primary btn-sm">Ver Publicacion / Comentar</Link>
                </div>
            )}
        </article>
    );
}
