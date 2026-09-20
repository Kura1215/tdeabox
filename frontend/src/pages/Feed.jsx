import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import SidebarPerfil from '../components/SidebarPerfil';
import PostCard from '../components/PostCard';
import Alerta from '../components/Alerta';

export default function Feed() {
    const { usuario } = useAuth();

    const [categorias, setCategorias] = useState([]);
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [posts, setPosts] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [alerta, setAlerta] = useState({ mensaje: '', tipo: '' });

    useEffect(() => {
        api.listarCategorias()
            .then(setCategorias)
            .catch(() => setAlerta({ mensaje: 'No se pudieron cargar las categorias del foro.', tipo: 'error' }));
    }, []);

    useEffect(() => {
        cargarPublicaciones();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categoriaSeleccionada]);

    async function cargarPublicaciones(textoBusqueda = busqueda) {
        setCargando(true);
        setAlerta({ mensaje: '', tipo: '' });

        try {
            const data = await api.listarPosts(categoriaSeleccionada, textoBusqueda);
            setPosts(data);
        } catch (error) {
            setPosts([]);
            setAlerta({ mensaje: 'No se pudieron obtener las publicaciones del servidor.', tipo: 'error' });
        } finally {
            setCargando(false);
        }
    }

    function handleBuscar() {
        cargarPublicaciones(busqueda);
    }

    function handleFiltroClick(id) {
        setCategoriaSeleccionada(id);
        setBusqueda('');
    }

    return (
        <>
            <Navbar />
            <div className="container">
                <aside className="sidebar">
                    <SidebarPerfil nombre={usuario?.nombre} username={usuario?.username} fotoPerfil={usuario?.fotoPerfil} mostrarEditar />

                    <div className="box sidebar-widget">
                        <div className="box-header">CATEGORIAS</div>
                        <div className="box-body" style={{ padding: '8px' }}>
                            <div className="filtros" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
                                <button
                                    className={`filtro-btn ${categoriaSeleccionada === '' ? 'activo' : ''}`}
                                    onClick={() => handleFiltroClick('')}
                                >
                                    Todos
                                </button>
                                {categorias.map((cat) => (
                                    <button
                                        key={cat.id}
                                        className={`filtro-btn ${categoriaSeleccionada === String(cat.id) ? 'activo' : ''}`}
                                        onClick={() => handleFiltroClick(String(cat.id))}
                                    >
                                        {cat.nombre}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </aside>

                <main className="main-content">
                    <div className="search-bar">
                        <input
                            type="text"
                            placeholder="Buscar publicaciones por titulo..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleBuscar(); }}
                        />
                        <button className="btn btn-primary" onClick={handleBuscar}>Buscar</button>
                    </div>

                    <Alerta mensaje={alerta.mensaje} tipo={alerta.tipo} />

                    <div>
                        {cargando && (
                            <p style={{ textAlign: 'center', color: 'var(--gris-medio)', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
                                Cargando publicaciones...
                            </p>
                        )}

                        {!cargando && posts.length === 0 && (
                            <div className="box" style={{ padding: '20px', textAlign: 'center', color: 'var(--gris-medio)', fontFamily: 'Arial, sans-serif' }}>
                                No hay publicaciones registradas para mostrar.
                            </div>
                        )}

                        {!cargando && posts.map((post) => (
                            <PostCard key={post.id} post={post} />
                        ))}
                    </div>
                </main>
            </div>
        </>
    );
}
