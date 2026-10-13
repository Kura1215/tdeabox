import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import SidebarPerfil from '../components/SidebarPerfil';
import PostCard from '../components/PostCard';
import Alerta from '../components/Alerta';

// perfil publico de otro usuario (solo lectura)
export default function PerfilUsuario() {
    const { id } = useParams();
    const { usuario } = useAuth();

    const [datos, setDatos] = useState(null);
    const [posts, setPosts] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [alerta, setAlerta] = useState({ mensaje: '', tipo: '' });

    useEffect(() => {
        setCargando(true);
        api.verUsuario(id)
            .then((data) => {
                setDatos(data);
                setPosts(data.posts || []);
            })
            .catch(() => setAlerta({ mensaje: 'No se pudo cargar el perfil del usuario.', tipo: 'error' }))
            .finally(() => setCargando(false));
    }, [id]);

    if (usuario && String(usuario.usuarioId) === id) {
        return <Navigate to="/perfil" replace />;
    }

    return (
        <>
            <Navbar />
            <div className="container">
                <aside className="sidebar">
                    <SidebarPerfil nombre={datos?.nombre} username={datos?.username} fotoPerfil={datos?.fotoPerfil} />
                </aside>

                <main className="main-content">
                    <Alerta mensaje={alerta.mensaje} tipo={alerta.tipo} />

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
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
