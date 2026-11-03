import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import SidebarPerfil from '../components/SidebarPerfil';
import PostCard from '../components/PostCard';
import Alerta from '../components/Alerta';

// Contenido mas popular de los ultimos 7 dias
export default function Ranking() {
    const { usuario } = useAuth();
    const [posts, setPosts] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [alerta, setAlerta] = useState({ mensaje: '', tipo: '' });

    useEffect(() => {
        api.ranking()
            .then((d) => setPosts(d.posts))
            .catch((e) => setAlerta({ mensaje: e.message, tipo: 'error' }))
            .finally(() => setCargando(false));
    }, []);

    return (
        <>
            <Navbar />
            <div className="container">
                <aside className="sidebar">
                    <SidebarPerfil nombre={usuario?.nombre} username={usuario?.username} fotoPerfil={usuario?.fotoPerfil} mostrarEditar />
                </aside>

                <main className="main-content">
                    <Alerta mensaje={alerta.mensaje} tipo={alerta.tipo} />
                    <div className="box">
                        <div className="box-header">🏆 RANKING SEMANAL (ULTIMOS 7 DIAS)</div>
                        <div className="box-body" style={{ padding: '10px 10px 2px 10px' }}>
                            {cargando && <p style={{ textAlign: 'center', padding: '20px' }}>Cargando...</p>}
                            {!cargando && posts.length === 0 && (
                                <p style={{ textAlign: 'center', color: 'var(--gris-medio)', padding: '20px' }}>
                                    Aun no hay publicaciones esta semana.
                                </p>
                            )}
                            {posts.map((post, i) => (
                                <div key={post.id}>
                                    <div className="puesto-ranking">#{i + 1}</div>
                                    <PostCard post={post} />
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
