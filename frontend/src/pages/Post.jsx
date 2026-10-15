import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, API_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import { obtenerClaseCategoria, formatearFecha } from '../utils';
import Navbar from '../components/Navbar';
import SidebarPerfil from '../components/SidebarPerfil';
import ComentarioItem from '../components/ComentarioItem';
import AutorPost from '../components/AutorPost';
import Reportar from '../components/Reportar';
import Alerta from '../components/Alerta';

export default function Post() {
    const { id } = useParams();
    const { usuario } = useAuth();
    const navigate = useNavigate();

    const [post, setPost] = useState(null);
    const [comentarios, setComentarios] = useState([]);
    const [paginacion, setPaginacion] = useState({ page: 1, paginas: 1 });
    const [noEncontrado, setNoEncontrado] = useState(false);
    const [comentarioTexto, setComentarioTexto] = useState('');
    const [comentarioImagen, setComentarioImagen] = useState(null);
    const [enviando, setEnviando] = useState(false);
    const [alerta, setAlerta] = useState({ mensaje: '', tipo: '' });
    const inputImagenRef = useRef(null);

    useEffect(() => {
        cargarDetalle();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    async function cargarDetalle() {
        try {
            const data = await api.verPost(id);
            setPost(data);
            await cargarComentarios(1, true);
        } catch (error) {
            setNoEncontrado(true);
            setAlerta({ mensaje: 'No se pudo encontrar la publicacion especificada.', tipo: 'error' });
        }
    }

    // reemplaza (reiniciar) o agrega la pagina siguiente de comentarios
    async function cargarComentarios(page, reiniciar) {
        const data = await api.listarComentarios(id, page);
        setComentarios((prev) => (reiniciar ? data.comentarios : [...prev, ...data.comentarios]));
        setPaginacion(data.paginacion);
    }

    async function recargarComentarios() {
        try {
            // mantiene todas las paginas ya cargadas
            const hasta = paginacion.page;
            let todos = [];
            for (let p = 1; p <= hasta; p++) {
                const data = await api.listarComentarios(id, p);
                todos = todos.concat(data.comentarios);
                setPaginacion(data.paginacion);
            }
            setComentarios(todos);
            setPost(await api.verPost(id));
        } catch (error) {
            setAlerta({ mensaje: error.message, tipo: 'error' });
        }
    }

    async function handleLikePost() {
        try {
            const res = await api.likePost(id);
            setPost({ ...post, ...res });
        } catch (error) {
            setAlerta({ mensaje: error.message || 'No se pudo registrar el like.', tipo: 'error' });
        }
    }

    async function handleGuardar() {
        try {
            const res = await api.guardarPost(id);
            setPost({ ...post, guardado: res.guardado });
        } catch (error) {
            setAlerta({ mensaje: error.message, tipo: 'error' });
        }
    }

    async function handleEliminarPost() {
        if (!confirm('¿Eliminar esta publicacion? Se borraran tambien sus comentarios.')) return;
        try {
            await api.eliminarPost(id);
            navigate('/feed');
        } catch (error) {
            setAlerta({ mensaje: error.message, tipo: 'error' });
        }
    }

    async function handleEnviarComentario(e) {
        e.preventDefault();
        setAlerta({ mensaje: '', tipo: '' });

        if (!comentarioTexto.trim()) {
            setAlerta({ mensaje: 'Por favor, escribe un comentario.', tipo: 'error' });
            return;
        }

        const formData = new FormData();
        formData.append('contenido', comentarioTexto.trim());
        if (comentarioImagen) {
            formData.append('imagen', comentarioImagen);
        }

        try {
            setEnviando(true);
            await api.crearComentario(id, formData);
            setAlerta({ mensaje: 'Comentario enviado correctamente.', tipo: 'ok' });

            setComentarioTexto('');
            setComentarioImagen(null);
            if (inputImagenRef.current) inputImagenRef.current.value = '';

            await cargarDetalle();
        } catch (error) {
            setAlerta({ mensaje: error.message || 'No se pudo enviar el comentario.', tipo: 'error' });
        } finally {
            setEnviando(false);
        }
    }

    async function handleEliminarComentario(comentarioId) {
        if (!confirm('¿Estas seguro de que deseas eliminar este comentario?')) return;

        try {
            setAlerta({ mensaje: '', tipo: '' });
            await api.eliminarComentario(comentarioId);
            setAlerta({ mensaje: 'Comentario eliminado correctamente.', tipo: 'ok' });
            await recargarComentarios();
        } catch (error) {
            setAlerta({ mensaje: error.message || 'No se pudo eliminar el comentario.', tipo: 'error' });
        }
    }

    const puedeEliminar = post && (post.esMio || usuario?.rol === 'admin');

    return (
        <>
            <Navbar />
            <div className="container">
                <aside className="sidebar">
                    <div className="sidebar-widget">
                        <button className="btn btn-primary" style={{ display: 'block', width: '100%', textAlign: 'center', marginBottom: '12px' }}
                            onClick={() => navigate('/feed')}>
                            ◀ Volver al Feed
                        </button>
                    </div>
                    <SidebarPerfil nombre={usuario?.nombre} username={usuario?.username} fotoPerfil={usuario?.fotoPerfil} />
                </aside>

                <main className="main-content">
                    <Alerta mensaje={alerta.mensaje} tipo={alerta.tipo} />

                    <div className="box post-completo" style={{ background: 'var(--blanco)', border: '1px solid var(--borde)', borderRadius: '4px' }}>
                        {!post && !noEncontrado && (
                            <p style={{ textAlign: 'center', color: 'var(--gris-medio)', fontFamily: 'Arial, sans-serif' }}>
                                Cargando detalles de la publicacion...
                            </p>
                        )}

                        {noEncontrado && (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--rojo)', fontFamily: 'Arial, sans-serif' }}>
                                No se pudo cargar la publicacion o no existe.
                            </div>
                        )}

                        {post && (
                            <>
                                <h2>{post.titulo}</h2>
                                <div className="post-meta" style={{ borderBottom: '1px solid var(--gris-claro)', paddingBottom: '8px' }}>
                                    Publicado por <AutorPost item={post} /> el {formatearFecha(post.fechaCreacion)} en{' '}
                                    <span className={`badge ${obtenerClaseCategoria(post.categoriaId)}`}>{post.nombreCategoria}</span>
                                    {post.editado && <span className="marca-editado"> · editado el {formatearFecha(post.editadoAt)}</span>}
                                </div>

                                {post.tags.length > 0 && (
                                    <div className="tags" style={{ marginTop: '8px' }}>
                                        {post.tags.map((t) => <Link key={t} to={`/feed?tag=${encodeURIComponent(t)}`} className="tag">#{t}</Link>)}
                                    </div>
                                )}

                                <div style={{ fontSize: '14px', lineHeight: 1.6, margin: '14px 0', whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>
                                    {post.contenido}
                                </div>

                                <div className="acciones-post">
                                    <button className={`btn btn-sm ${post.likedByMe ? 'btn-primary' : 'btn-secundario'}`} onClick={handleLikePost}>
                                        ♥ {post.likes}
                                    </button>
                                    <button className={`btn btn-sm ${post.guardado ? 'btn-primary' : 'btn-secundario'}`} onClick={handleGuardar}>
                                        {post.guardado ? '★ Guardado' : '☆ Guardar'}
                                    </button>
                                    {post.esMio && (
                                        <Link to={`/editar-post/${post.id}`} className="btn btn-sm btn-secundario">Editar</Link>
                                    )}
                                    {puedeEliminar && (
                                        <button className="btn btn-sm btn-danger" onClick={handleEliminarPost}>Eliminar</button>
                                    )}
                                    {!post.esMio && <Reportar tipo="post" id={post.id} />}
                                </div>

                                {post.imagenUrl && (
                                    <div style={{ textAlign: 'center', marginTop: '12px' }}>
                                        <img src={`${API_URL}${post.imagenUrl}`} alt="Imagen de la publicacion" className="post-img" style={{ maxHeight: '450px', objectFit: 'contain' }} />
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="box">
                        <div className="box-header">RESPUESTAS Y DEBATES</div>
                        <div className="box-body" style={{ padding: 0 }}>
                            {comentarios.length === 0 && (
                                <p style={{ textAlign: 'center', color: 'var(--gris-medio)', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
                                    No hay comentarios todavia. ¡Se el primero en responder!
                                </p>
                            )}

                            {comentarios.map((com) => (
                                <ComentarioItem key={com.id} comentario={com} onEliminar={handleEliminarComentario} onCambio={recargarComentarios} />
                            ))}

                            {paginacion.page < paginacion.paginas && (
                                <div style={{ textAlign: 'center', padding: '10px' }}>
                                    <button className="btn btn-sm btn-primary" onClick={() => cargarComentarios(paginacion.page + 1, false)}>
                                        Cargar mas comentarios
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="box">
                        <div className="box-header">AÑADIR RESPUESTA</div>
                        <div className="box-body">
                            <form onSubmit={handleEnviarComentario}>
                                <div className="form-group">
                                    <label htmlFor="comment-text">Escribe tu comentario (puedes mencionar con @usuario)</label>
                                    <textarea id="comment-text" rows="3" maxLength={500} placeholder="Aporta a la discusion o responde dudas..."
                                        value={comentarioTexto} onChange={(e) => setComentarioTexto(e.target.value)} required />
                                    <small className="ayuda">{comentarioTexto.length}/500</small>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="comment-image">Adjuntar Imagen (Opcional, JPG/PNG/WEBP, max. 3 MB)</label>
                                    <input type="file" id="comment-image" accept="image/jpeg,image/png,image/webp" ref={inputImagenRef}
                                        onChange={(e) => setComentarioImagen(e.target.files[0] || null)} />
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ marginTop: '6px' }} disabled={enviando}>
                                    {enviando ? 'Enviando...' : 'Enviar Comentario'}
                                </button>
                            </form>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
