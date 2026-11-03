import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import SidebarPerfil from '../components/SidebarPerfil';
import PostCard from '../components/PostCard';
import Alerta from '../components/Alerta';
import RelacionesUsuario from '../components/RelacionesUsuario';

// Perfil propio (vista de edicion): datos, estadisticas, insignias, mis posts y guardados privados
export default function Perfil() {
    const { usuario, actualizarPerfil } = useAuth();

    const [datos, setDatos] = useState(null);
    const [posts, setPosts] = useState([]);
    const [paginacion, setPaginacion] = useState({ page: 1, paginas: 1 });
    const [pestana, setPestana] = useState('publicaciones');
    const [guardados, setGuardados] = useState([]);
    const [paginacionGuardados, setPaginacionGuardados] = useState({ page: 1, paginas: 1 });
    const [nombre, setNombre] = useState('');
    const [biografia, setBiografia] = useState('');
    const [programa, setPrograma] = useState('');
    const [avatarFile, setAvatarFile] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [alerta, setAlerta] = useState({ mensaje: '', tipo: '' });
    const inputAvatarRef = useRef(null);

    useEffect(() => {
        cargarPerfil();
    }, []);

    useEffect(() => {
        if (pestana === 'guardados') cargarGuardados(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pestana]);

    async function cargarPerfil() {
        try {
            const data = await api.verPerfil();
            setDatos(data);
            setNombre(data.nombre);
            setBiografia(data.biografia || '');
            setPrograma(data.programaAcademico || '');
            setPosts(data.posts || []);
            setPaginacion(data.paginacion);
            actualizarPerfil(data.nombre, data.fotoPerfil);
        } catch (error) {
            setAlerta({ mensaje: 'No se pudieron obtener los datos de tu cuenta desde el servidor.', tipo: 'error' });
        }
    }

    async function cargarMasPosts() {
        const data = await api.verPerfil(paginacion.page + 1);
        setPosts((prev) => [...prev, ...data.posts]);
        setPaginacion(data.paginacion);
    }

    async function cargarGuardados(page) {
        try {
            const data = await api.guardados(page);
            setGuardados((prev) => (page === 1 ? data.posts : [...prev, ...data.posts]));
            setPaginacionGuardados(data.paginacion);
        } catch (error) {
            setAlerta({ mensaje: error.message, tipo: 'error' });
        }
    }

    async function handleGuardar(e) {
        e.preventDefault();
        setAlerta({ mensaje: '', tipo: '' });

        if (!nombre.trim()) {
            setAlerta({ mensaje: 'El nombre completo no puede estar vacio.', tipo: 'error' });
            return;
        }

        const formData = new FormData();
        formData.append('nombre', nombre.trim());
        formData.append('biografia', biografia.trim());
        formData.append('programaAcademico', programa.trim());

        if (avatarFile) {
            formData.append('foto', avatarFile);
        }

        try {
            setGuardando(true);
            const res = await api.editarPerfil(formData);
            actualizarPerfil(res.nombre, res.fotoPerfil);
            setAlerta({ mensaje: '¡Datos de perfil guardados con exito!', tipo: 'ok' });

            setAvatarFile(null);
            if (inputAvatarRef.current) inputAvatarRef.current.value = '';

            await cargarPerfil();
        } catch (error) {
            setAlerta({ mensaje: error.message || 'Error al intentar actualizar los datos personales.', tipo: 'error' });
        } finally {
            setGuardando(false);
        }
    }

    async function handleEliminarPost(postId) {
        const confirmar = confirm('¿Estas seguro de que deseas eliminar esta publicacion permanentemente? Esta accion borrara todas sus respuestas asociadas.');
        if (!confirmar) return;

        try {
            await api.eliminarPost(postId);
            setAlerta({ mensaje: '¡Publicacion eliminada correctamente!', tipo: 'ok' });
            await cargarPerfil();
        } catch (error) {
            setAlerta({ mensaje: error.message || 'Error al intentar eliminar la publicacion del servidor.', tipo: 'error' });
        }
    }

    const est = datos?.estadisticas;

    return (
        <>
            <Navbar />
            <div className="container">
                <aside className="sidebar">
                    <SidebarPerfil nombre={usuario?.nombre} username={usuario?.username} fotoPerfil={usuario?.fotoPerfil} />
                </aside>

                <main className="main-content">
                    <Alerta mensaje={alerta.mensaje} tipo={alerta.tipo} />

                    {datos && (
                        <div className="box">
                            <div className="box-header">MI ACTIVIDAD</div>
                            <div className="box-body">
                                <div className="estadisticas">
                                    <div><strong>{est.posts}</strong><span>publicaciones</span></div>
                                    <div><strong>{est.comentarios}</strong><span>comentarios</span></div>
                                    <div><strong>{est.likesRecibidos}</strong><span>likes recibidos</span></div>
                                </div>
                                {datos.insignias.length > 0 && (
                                    <div style={{ marginTop: '8px' }}>
                                        {datos.insignias.map((i) => <span key={i} className="insignia">🏅 {i}</span>)}
                                    </div>
                                )}
                                <div style={{ marginTop: '8px' }}>
                                    <RelacionesUsuario usuarioId={datos.id} seguidores={datos.seguidores} seguidos={datos.seguidos} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="box">
                        <div className="box-header">EDITAR DATOS PERSONALES</div>
                        <div className="box-body">
                            <form onSubmit={handleGuardar}>
                                <div className="form-group">
                                    <label htmlFor="profile-name">Nombre Completo</label>
                                    <input type="text" id="profile-name" maxLength={100} placeholder="Tu nombre real..."
                                        value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="profile-bio">Biografia (opcional)</label>
                                    <textarea id="profile-bio" rows="2" maxLength={200} placeholder="Cuentale a la comunidad quien eres..."
                                        value={biografia} onChange={(e) => setBiografia(e.target.value)} />
                                    <small className="ayuda">{biografia.length}/200</small>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="profile-programa">Programa academico (opcional)</label>
                                    <input type="text" id="profile-programa" maxLength={80} placeholder="Ej: Tecnologia en Desarrollo de Software"
                                        value={programa} onChange={(e) => setPrograma(e.target.value)} />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="profile-username">Nombre de Usuario (Username)</label>
                                    <input type="text" id="profile-username" value={datos?.username || ''} disabled
                                        style={{ cursor: 'not-allowed', opacity: 0.7 }} />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="profile-email">Correo Institucional</label>
                                    <input type="email" id="profile-email" value={datos?.correo || ''} disabled
                                        style={{ cursor: 'not-allowed', opacity: 0.7 }} />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="profile-avatar">Actualizar Foto de Perfil (Opcional, JPG/PNG/WEBP, max. 2 MB)</label>
                                    <input type="file" id="profile-avatar" accept="image/jpeg,image/png,image/webp" ref={inputAvatarRef}
                                        onChange={(e) => setAvatarFile(e.target.files[0] || null)} />
                                </div>

                                <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }} disabled={guardando}>
                                    {guardando ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="pestanas">
                        <button className={`filtro-btn ${pestana === 'publicaciones' ? 'activo' : ''}`} onClick={() => setPestana('publicaciones')}>
                            Mis publicaciones
                        </button>
                        <button className={`filtro-btn ${pestana === 'guardados' ? 'activo' : ''}`} onClick={() => setPestana('guardados')}>
                            ★ Guardados (privado)
                        </button>
                    </div>

                    {pestana === 'publicaciones' && (
                        <div className="box">
                            <div className="box-header">MIS PUBLICACIONES</div>
                            <div className="box-body" style={{ padding: '10px 10px 2px 10px' }}>
                                {posts.length === 0 && (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--gris-medio)', fontFamily: 'Arial, sans-serif' }}>
                                        No has realizado publicaciones en el foro todavia.
                                    </div>
                                )}

                                {posts.map((post) => (
                                    <PostCard key={post.id} post={post} onEliminar={handleEliminarPost} />
                                ))}

                                {paginacion.page < paginacion.paginas && (
                                    <div style={{ textAlign: 'center', paddingBottom: '10px' }}>
                                        <button className="btn btn-sm btn-primary" onClick={cargarMasPosts}>Cargar mas</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {pestana === 'guardados' && (
                        <div className="box">
                            <div className="box-header">PUBLICACIONES GUARDADAS</div>
                            <div className="box-body" style={{ padding: '10px 10px 2px 10px' }}>
                                {guardados.length === 0 && (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--gris-medio)', fontFamily: 'Arial, sans-serif' }}>
                                        Aun no has guardado publicaciones. Solo tu puedes ver esta lista.
                                    </div>
                                )}

                                {guardados.map((post) => (
                                    <PostCard key={post.id} post={post} />
                                ))}

                                {paginacionGuardados.page < paginacionGuardados.paginas && (
                                    <div style={{ textAlign: 'center', paddingBottom: '10px' }}>
                                        <button className="btn btn-sm btn-primary" onClick={() => cargarGuardados(paginacionGuardados.page + 1)}>
                                            Cargar mas
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
