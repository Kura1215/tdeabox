import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import SidebarPerfil from '../components/SidebarPerfil';
import PostCard from '../components/PostCard';
import Alerta from '../components/Alerta';
import RelacionesUsuario from '../components/RelacionesUsuario';

// perfil publico de otro usuario (solo lectura): no muestra correo, guardados ni posts anonimos
export default function PerfilUsuario() {
    const { id } = useParams();
    const { usuario } = useAuth();

    const [datos, setDatos] = useState(null);
    const [posts, setPosts] = useState([]);
    const [paginacion, setPaginacion] = useState({ page: 1, paginas: 1 });
    const [cargando, setCargando] = useState(true);
    const [alerta, setAlerta] = useState({ mensaje: '', tipo: '' });

    useEffect(() => {
        setCargando(true);
        api.verUsuario(id)
            .then((data) => {
                setDatos(data);
                setPosts(data.posts || []);
                setPaginacion(data.paginacion);
            })
            .catch(() => setAlerta({ mensaje: 'No se pudo cargar el perfil del usuario.', tipo: 'error' }))
            .finally(() => setCargando(false));
    }, [id]);

    if (usuario && String(usuario.usuarioId) === id) {
        return <Navigate to="/perfil" replace />;
    }

    async function handleSeguir() {
        try {
            const res = await api.seguir(id);
            setDatos((prev) => ({ ...prev, siguiendo: res.siguiendo, seguidores: res.seguidores }));
        } catch (error) {
            setAlerta({ mensaje: error.message, tipo: 'error' });
        }
    }

    async function cargarMas() {
        const data = await api.verUsuario(id, paginacion.page + 1);
        setPosts((prev) => [...prev, ...data.posts]);
        setPaginacion(data.paginacion);
    }

    return (
        <>
            <Navbar />
            <div className="container">
                <aside className="sidebar">
                    <SidebarPerfil nombre={datos?.nombre} username={datos?.username} fotoPerfil={datos?.fotoPerfil} />
                    {datos && (
                        <button className={`btn ${datos.siguiendo ? 'btn-secundario' : 'btn-primary'}`}
                            style={{ display: 'block', width: '100%' }} onClick={handleSeguir}>
                            {datos.siguiendo ? '✓ Siguiendo' : '+ Seguir'}
                        </button>
                    )}
                </aside>

                <main className="main-content">
                    <Alerta mensaje={alerta.mensaje} tipo={alerta.tipo} />

                    {datos && (
                        <div className="box">
                            <div className="box-header">PERFIL PUBLICO</div>
                            <div className="box-body">
                                {datos.programaAcademico && <p><strong>Programa:</strong> {datos.programaAcademico}</p>}
                                {datos.biografia && <p style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{datos.biografia}</p>}
                                {!datos.programaAcademico && !datos.biografia && (
                                    <p style={{ color: 'var(--gris-medio)' }}>Este usuario aun no ha completado su perfil.</p>
                                )}

                                <div className="estadisticas" style={{ marginTop: '10px' }}>
                                    <div><strong>{datos.estadisticas.posts}</strong><span>publicaciones</span></div>
                                    <div><strong>{datos.estadisticas.comentarios}</strong><span>comentarios</span></div>
                                    <div><strong>{datos.estadisticas.likesRecibidos}</strong><span>likes recibidos</span></div>
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
                        <div className="box-header">PUBLICACIONES DE {datos?.nombre?.toUpperCase() || 'USUARIO'}</div>
                        <div className="box-body" style={{ padding: '10px 10px 2px 10px' }}>
                            {cargando && (
                                <p style={{ textAlign: 'center', color: 'var(--gris-medio)', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
                                    Cargando publicaciones...
                                </p>
                            )}

                            {!cargando && posts.length === 0 && (
                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--gris-medio)', fontFamily: 'Arial, sans-serif' }}>
                                    Este usuario no ha realizado publicaciones todavia.
                                </div>
                            )}

                            {posts.map((post) => (
                                <PostCard key={post.id} post={post} />
                            ))}

                            {paginacion.page < paginacion.paginas && (
                                <div style={{ textAlign: 'center', paddingBottom: '10px' }}>
                                    <button className="btn btn-sm btn-primary" onClick={cargarMas}>Cargar mas</button>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
