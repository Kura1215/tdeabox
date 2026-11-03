import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import SidebarPerfil from '../components/SidebarPerfil';
import PostCard from '../components/PostCard';
import Alerta from '../components/Alerta';

const FILTROS_VACIOS = { categoria: '', q: '', autor: '', desde: '', hasta: '', siguiendo: false };

const POR_PAGINA = 20;   // maximo que permite el backend por peticion
const TOPE_POSTS = 500;  // tope de publicaciones en memoria para no afectar el rendimiento

// minusculas y sin tildes para que "academico" encuentre "Académico"
function normalizar(texto) {
    return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function coincide(post, f, tag) {
    if (f.categoria && String(post.categoriaId) !== f.categoria) return false;
    if (tag && !post.tags.includes(tag.toLowerCase())) return false;
    if (f.autor) {
        const a = normalizar(f.autor.replace(/^@/, ''));
        if (!normalizar(post.usernameUsuario).includes(a) && !normalizar(post.nombreUsuario).includes(a)) return false;
    }
    if (f.desde && new Date(post.fechaCreacion) < new Date(`${f.desde}T00:00:00`)) return false;
    if (f.hasta && new Date(post.fechaCreacion) >= new Date(new Date(`${f.hasta}T00:00:00`).getTime() + 86400000)) return false;
    if (f.q) {
        const texto = normalizar(`${post.titulo} ${post.contenido} ${post.tags.join(' ')}`);
        if (!normalizar(f.q).split(/\s+/).filter(Boolean).every((palabra) => texto.includes(palabra))) return false;
    }
    return true;
}

export default function Feed() {
    const { usuario } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const tag = searchParams.get('tag') || '';

    const [categorias, setCategorias] = useState([]);
    const [filtros, setFiltros] = useState(FILTROS_VACIOS);
    const [avanzado, setAvanzado] = useState(false);
    const [posts, setPosts] = useState([]);        // todas las publicaciones cargadas hasta ahora
    const [pagina, setPagina] = useState(0);       // ultima pagina cargada del servidor
    const [hayMas, setHayMas] = useState(true);
    const [cargando, setCargando] = useState(true);
    const [alerta, setAlerta] = useState({ mensaje: '', tipo: '' });
    const peticion = useRef(0);                    // descarta respuestas de una carga anterior
    const centinela = useRef(null);

    useEffect(() => {
        api.listarCategorias()
            .then(setCategorias)
            .catch(() => setAlerta({ mensaje: 'No se pudieron cargar las categorias del foro.', tipo: 'error' }));
    }, []);

    // Al abrir el feed (o cambiar "solo quienes sigo", que solo el servidor puede saber) se reinicia la lista
    useEffect(() => {
        peticion.current += 1;
        setPosts([]);
        setPagina(0);
        setHayMas(true);
        setCargando(false);
    }, [filtros.siguiendo]);

    const cargarSiguiente = useCallback(async () => {
        const id = peticion.current;
        setCargando(true);
        try {
            const data = await api.listarPosts({ siguiendo: filtros.siguiendo }, pagina + 1, POR_PAGINA);
            if (id !== peticion.current) return;
            setPosts((prev) => {
                const vistos = new Set(prev.map((p) => p.id));
                return [...prev, ...data.posts.filter((p) => !vistos.has(p.id))];
            });
            setPagina(data.paginacion.page);
            setHayMas(data.paginacion.page < data.paginacion.paginas);
            setAlerta({ mensaje: '', tipo: '' });
        } catch (error) {
            if (id !== peticion.current) return;
            setHayMas(false);
            setAlerta({ mensaje: error.message || 'No se pudieron obtener las publicaciones del servidor.', tipo: 'error' });
        } finally {
            if (id === peticion.current) setCargando(false);
        }
    }, [filtros.siguiendo, pagina]);

    // el filtrado se hace en el navegador sobre lo ya cargado: instantaneo y sin peticiones por tecla
    const filtroTexto = useDeferredValue(filtros);
    const visibles = useMemo(
        () => posts.filter((p) => coincide(p, filtroTexto, tag)),
        [posts, filtroTexto, tag]
    );

    const hayFiltro = Boolean(filtros.q || filtros.autor || filtros.desde || filtros.hasta || filtros.categoria || tag);
    const puedeCargar = hayMas && !cargando && posts.length < TOPE_POSTS;

    // carga automatica: la primera pagina siempre, y mientras haya un filtro activo se siguen trayendo
    // paginas (de a 20, hasta el tope) para que la busqueda cubra todas las publicaciones
    useEffect(() => {
        if (puedeCargar && (pagina === 0 || hayFiltro)) cargarSiguiente();
    }, [puedeCargar, pagina, hayFiltro, cargarSiguiente]);

    // sin filtro, las siguientes paginas se piden al llegar al final de la lista (scroll infinito)
    useEffect(() => {
        const el = centinela.current;
        if (!el || !puedeCargar) return undefined;
        const observador = new IntersectionObserver((entradas) => {
            if (entradas[0].isIntersecting) cargarSiguiente();
        }, { rootMargin: '300px' });
        observador.observe(el);
        return () => observador.disconnect();
    }, [puedeCargar, cargarSiguiente, visibles.length]);

    function cambiarFiltro(cambio) {
        setFiltros((prev) => ({ ...prev, ...cambio }));
    }

    function quitarTag() {
        setSearchParams({});
    }

    function limpiar() {
        setFiltros(FILTROS_VACIOS);
        setSearchParams({});
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
                            placeholder="Buscar en titulo, contenido y etiquetas..."
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
                        {(hayFiltro || filtros.siguiendo) && (
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
                        {visibles.map((post) => (
                            <PostCard key={post.id} post={post} />
                        ))}

                        {cargando && (
                            <p style={{ textAlign: 'center', color: 'var(--gris-medio)', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
                                {hayFiltro ? 'Buscando en las publicaciones...' : 'Cargando publicaciones...'}
                            </p>
                        )}

                        {!cargando && visibles.length === 0 && !hayMas && (
                            <div className="box" style={{ padding: '20px', textAlign: 'center', color: 'var(--gris-medio)', fontFamily: 'Arial, sans-serif' }}>
                                No hay publicaciones para mostrar.
                            </div>
                        )}
                    </div>

                    {hayMas && posts.length >= TOPE_POSTS && (
                        <p style={{ textAlign: 'center', color: 'var(--gris-medio)', fontFamily: 'Arial, sans-serif', padding: '12px' }}>
                            Se muestran las {TOPE_POSTS} publicaciones mas recientes. Usa los filtros para acotar.
                        </p>
                    )}

                    <div ref={centinela} style={{ height: 1 }} />
                </main>
            </div>
        </>
    );
}
