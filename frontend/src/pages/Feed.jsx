import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import SidebarPerfil from '../components/SidebarPerfil';
import PostCard from '../components/PostCard';
import Alerta from '../components/Alerta';

const FILTROS_VACIOS = { categoria: '', q: '', autor: '', desde: '', hasta: '', siguiendo: false };

export default function Feed() {
    const { usuario } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const tag = searchParams.get('tag') || '';

    const [categorias, setCategorias] = useState([]);
    const [filtros, setFiltros] = useState(FILTROS_VACIOS);
    const [avanzado, setAvanzado] = useState(false);
    const [page, setPage] = useState(1);
    const [posts, setPosts] = useState([]);
    const [paginacion, setPaginacion] = useState({ page: 1, paginas: 1, total: 0 });
    const [cargando, setCargando] = useState(true);
    const [alerta, setAlerta] = useState({ mensaje: '', tipo: '' });

    useEffect(() => {
        api.listarCategorias()
            .then(setCategorias)
            .catch(() => setAlerta({ mensaje: 'No se pudieron cargar las categorias del foro.', tipo: 'error' }));
    }, []);

    // busqueda en vivo: esperamos 300ms despues del ultimo cambio antes de pedir los posts
    useEffect(() => {
        const espera = setTimeout(cargarPublicaciones, 300);
        return () => clearTimeout(espera);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtros, tag, page]);

    async function cargarPublicaciones() {
        setCargando(true);
        setAlerta({ mensaje: '', tipo: '' });

        try {
            const data = await api.listarPosts({ ...filtros, tag }, page);
            setPosts(data.posts);
            setPaginacion(data.paginacion);
        } catch (error) {
            setPosts([]);
            setAlerta({ mensaje: error.message || 'No se pudieron obtener las publicaciones del servidor.', tipo: 'error' });
        } finally {
            setCargando(false);
        }
    }

    // cualquier cambio de filtro vuelve a la pagina 1
    function cambiarFiltro(cambio) {
        setFiltros((prev) => ({ ...prev, ...cambio }));
        setPage(1);
    }

    function quitarTag() {
        setSearchParams({});
        setPage(1);
    }

    function limpiar() {
        setFiltros(FILTROS_VACIOS);
        setSearchParams({});
        setPage(1);
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
                                    className={`filtro-btn ${filtros.categoria === '' ? 'activo' : ''}`}
                                    onClick={() => cambiarFiltro({ categoria: '' })}
                                >
                                    Todos
                                </button>
                                {categorias.map((cat) => (
                                    <button
                                        key={cat.id}
                                        className={`filtro-btn ${filtros.categoria === String(cat.id) ? 'activo' : ''}`}
                                        onClick={() => cambiarFiltro({ categoria: String(cat.id) })}
                                    >
                                        {cat.nombre}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="box sidebar-widget">
                        <div className="box-header">MAS</div>
                        <div className="box-body" style={{ padding: '8px', fontFamily: 'Arial, sans-serif', fontSize: '12px' }}>
                            <p><Link to="/ranking">🏆 Ranking semanal</Link></p>
                            <p style={{ marginTop: '6px' }}><Link to="/perfil">★ Mis guardados</Link></p>
                        </div>
                    </div>
                </aside>

                <main className="main-content">
                    <div className="search-bar">
                        <input
                            type="text"
                            maxLength={100}
                            placeholder="Buscar en titulo y contenido..."
                            value={filtros.q}
                            onChange={(e) => cambiarFiltro({ q: e.target.value })}
                        />
                        <button className="btn btn-sm btn-secundario" onClick={() => setAvanzado(!avanzado)}>
                            {avanzado ? 'Ocultar filtros' : 'Mas filtros'}
                        </button>
                    </div>

                    <div className="filtros-extra">
                        <label className="check">
                            <input type="checkbox" checked={filtros.siguiendo} onChange={(e) => cambiarFiltro({ siguiendo: e.target.checked })} />
                            Solo de quienes sigo
                        </label>
                        {tag && (
                            <span className="tag tag-activo">#{tag} <button onClick={quitarTag} aria-label="Quitar etiqueta">×</button></span>
                        )}
                        {(filtros.q || filtros.autor || filtros.desde || filtros.hasta || filtros.categoria || filtros.siguiendo || tag) && (
                            <button className="btn btn-sm btn-secundario" onClick={limpiar}>Limpiar filtros</button>
                        )}
                    </div>

                    {avanzado && (
                        <div className="box filtros-avanzados">
                            <div className="form-group">
                                <label htmlFor="f-autor">Autor (username)</label>
                                <input id="f-autor" type="text" value={filtros.autor} onChange={(e) => cambiarFiltro({ autor: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="f-desde">Desde</label>
                                <input id="f-desde" type="date" value={filtros.desde} onChange={(e) => cambiarFiltro({ desde: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="f-hasta">Hasta</label>
                                <input id="f-hasta" type="date" value={filtros.hasta} onChange={(e) => cambiarFiltro({ hasta: e.target.value })} />
                            </div>
                        </div>
                    )}

                    <Alerta mensaje={alerta.mensaje} tipo={alerta.tipo} />

                    <div>
                        {cargando && (
                            <p style={{ textAlign: 'center', color: 'var(--gris-medio)', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
                                Cargando publicaciones...
                            </p>
                        )}

                        {!cargando && posts.length === 0 && (
                            <div className="box" style={{ padding: '20px', textAlign: 'center', color: 'var(--gris-medio)', fontFamily: 'Arial, sans-serif' }}>
                                No hay publicaciones para mostrar.
                            </div>
                        )}

                        {!cargando && posts.map((post) => (
                            <PostCard key={post.id} post={post} />
                        ))}
                    </div>

                    {paginacion.paginas > 1 && (
                        <div className="paginacion">
                            <button className="btn btn-sm btn-primary" disabled={page <= 1} onClick={() => setPage(page - 1)}>◀ Anterior</button>
                            <span>Pagina {paginacion.page} de {paginacion.paginas} ({paginacion.total} publicaciones)</span>
                            <button className="btn btn-sm btn-primary" disabled={page >= paginacion.paginas} onClick={() => setPage(page + 1)}>Siguiente ▶</button>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
