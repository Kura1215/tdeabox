import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API_URL } from '../api';
import { obtenerClaseCategoria, formatearFecha } from '../utils';
import AutorPost from './AutorPost';

const LIMITE_SNIPPET = 200;

// tarjeta de un post para las listas del feed y del perfil
export default function PostCard({ post, onEliminar }) {
    const [likes, setLikes] = useState({ likes: post.likes, likedByMe: post.likedByMe });
    const [guardado, setGuardado] = useState(post.guardado);
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
                        <>Publicado por <AutorPost item={post} /> el {formatearFecha(post.fechaCreacion)} en </>
                    )}
                    {onEliminar && <>Publicado el {formatearFecha(post.fechaCreacion)}{post.esAnonimo ? ' (anónimo)' : ''} en </>}
                    <span className={`badge ${badgeClass}`}>{post.nombreCategoria}</span>
                    {post.editado && <span className="marca-editado" title={`Editado el ${formatearFecha(post.editadoAt)}`}> · editado</span>}
                </div>
                {onEliminar && (
                    <button className="btn btn-danger btn-sm" onClick={() => onEliminar(post.id)}>
                        Eliminar Publicacion
                    </button>
                )}
            </div>

            {post.tags?.length > 0 && (
                <div className="tags">
                    {post.tags.map((t) => <Link key={t} to={`/feed?tag=${encodeURIComponent(t)}`} className="tag">#{t}</Link>)}
                </div>
            )}

            <p style={{ fontSize: '13px', lineHeight: 1.5, marginBottom: '8px' }}>{snippet}</p>

            {post.imagenUrl && (
                <div>
                    <img src={`${API_URL}${post.imagenUrl}`} alt="Imagen del post" className="post-img" style={{ maxHeight: '250px', objectFit: 'cover' }} />
                </div>
            )}

            <div style={{ marginTop: '10px', textAlign: 'right' }}>
                <span className="contador-comentarios">💬 {post.totalComentarios}</span>
                <button className={`btn btn-sm ${likes.likedByMe ? 'btn-primary' : 'btn-secundario'}`} style={{ marginRight: '6px' }}
                    onClick={() => api.likePost(post.id).then(setLikes).catch(() => {})}>
                    ♥ {likes.likes}
                </button>
                <button className={`btn btn-sm ${guardado ? 'btn-primary' : 'btn-secundario'}`} style={{ marginRight: '6px' }}
                    onClick={() => api.guardarPost(post.id).then((r) => setGuardado(r.guardado)).catch(() => {})}>
                    {guardado ? '★ Guardado' : '☆ Guardar'}
                </button>
                {!onEliminar && (
                    <Link to={`/post/${post.id}`} className="btn btn-primary btn-sm">Ver Publicacion / Comentar</Link>
                )}
            </div>
        </article>
    );
}
