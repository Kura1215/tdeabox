import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatearFecha } from '../utils';
import Navbar from '../components/Navbar';
import SidebarPerfil from '../components/SidebarPerfil';
import Alerta from '../components/Alerta';

const ETIQUETA_TIPO = { comentario: '💬 Comentario', like: '♥ Like', seguidor: '👤 Seguidor', mencion: '@ Mencion' };

export default function Notificaciones() {
    const { usuario } = useAuth();
    const navigate = useNavigate();
    const [lista, setLista] = useState([]);
    const [noLeidas, setNoLeidas] = useState(0);
    const [paginacion, setPaginacion] = useState({ page: 1, paginas: 1 });
    const [cargando, setCargando] = useState(true);
    const [alerta, setAlerta] = useState({ mensaje: '', tipo: '' });

    useEffect(() => {
        cargar(1);
    }, []);

    async function cargar(page) {
        try {
            const data = await api.notificaciones(page);
            setLista((prev) => (page === 1 ? data.notificaciones : [...prev, ...data.notificaciones]));
            setNoLeidas(data.noLeidas);
            setPaginacion(data.paginacion);
        } catch (error) {
            setAlerta({ mensaje: error.message, tipo: 'error' });
        } finally {
            setCargando(false);
        }
    }

    async function alternarLeida(n) {
        try {
            await api.marcarNotificacion(n.id, !n.leido);
            setLista((prev) => prev.map((x) => (x.id === n.id ? { ...x, leido: !n.leido } : x)));
            setNoLeidas((c) => c + (n.leido ? 1 : -1));
        } catch (error) {
            setAlerta({ mensaje: error.message, tipo: 'error' });
        }
    }

    async function abrir(n) {
        if (!n.leido) await api.marcarNotificacion(n.id, true).catch(() => {});
        navigate(n.tipo === 'seguidor' ? `/usuario/${n.referenciaId}` : `/post/${n.referenciaId}`);
    }

    async function marcarTodas() {
        try {
            await api.marcarTodasLeidas();
            setLista((prev) => prev.map((x) => ({ ...x, leido: true })));
            setNoLeidas(0);
        } catch (error) {
            setAlerta({ mensaje: error.message, tipo: 'error' });
        }
    }

    return (
        <>
            <Navbar />
            <div className="container">
                <aside className="sidebar">
                    <SidebarPerfil nombre={usuario?.nombre} username={usuario?.username} fotoPerfil={usuario?.fotoPerfil} />
                </aside>

                <main className="main-content">
                    <Alerta mensaje={alerta.mensaje} tipo={alerta.tipo} />
                    <div className="box">
                        <div className="box-header">NOTIFICACIONES ({noLeidas} sin leer)</div>
                        <div className="box-body" style={{ padding: 0 }}>
                            {noLeidas > 0 && (
                                <div style={{ padding: '8px 10px', textAlign: 'right' }}>
                                    <button className="btn btn-sm btn-secundario" onClick={marcarTodas}>Marcar todas como leidas</button>
                                </div>
                            )}

                            {!cargando && lista.length === 0 && (
                                <p style={{ textAlign: 'center', color: 'var(--gris-medio)', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
                                    No tienes notificaciones todavia.
                                </p>
                            )}

                            {lista.map((n) => (
                                <div key={n.id} className={`notificacion ${n.leido ? '' : 'no-leida'}`}>
                                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => abrir(n)}>
                                        <small>{ETIQUETA_TIPO[n.tipo]} · {formatearFecha(n.fecha)}</small>
                                        <div>{n.mensaje}</div>
                                    </div>
                                    <button className="btn btn-sm btn-secundario" onClick={() => alternarLeida(n)}>
                                        {n.leido ? 'Marcar no leida' : 'Marcar leida'}
                                    </button>
                                </div>
                            ))}

                            {paginacion.page < paginacion.paginas && (
                                <div style={{ textAlign: 'center', padding: '10px' }}>
                                    <button className="btn btn-sm btn-primary" onClick={() => cargar(paginacion.page + 1)}>Cargar mas</button>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
