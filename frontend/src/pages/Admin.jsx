import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatearFecha } from '../utils';
import Navbar from '../components/Navbar';
import Alerta from '../components/Alerta';

const MOTIVOS = { spam: 'Spam', contenido_inapropiado: 'Contenido inapropiado', otro: 'Otro' };

// Panel exclusivo de administradores: reportes (RF08) y registro de auditoria
export default function Admin() {
    const { usuario } = useAuth();
    const [pestana, setPestana] = useState('reportes');
    const [estado, setEstado] = useState('pendiente');
    const [reportes, setReportes] = useState([]);
    const [registros, setRegistros] = useState([]);
    const [paginacion, setPaginacion] = useState({ page: 1, paginas: 1 });
    const [alerta, setAlerta] = useState({ mensaje: '', tipo: '' });

    useEffect(() => {
        if (usuario?.rol !== 'admin') return;
        cargar(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pestana, estado]);

    if (usuario?.rol !== 'admin') {
        return <Navigate to="/feed" replace />;
    }

    async function cargar(page) {
        try {
            if (pestana === 'reportes') {
                const d = await api.adminReportes(estado, page);
                setReportes((prev) => (page === 1 ? d.reportes : [...prev, ...d.reportes]));
                setPaginacion(d.paginacion);
            } else {
                const d = await api.adminAuditoria(page);
                setRegistros((prev) => (page === 1 ? d.registros : [...prev, ...d.registros]));
                setPaginacion(d.paginacion);
            }
        } catch (error) {
            setAlerta({ mensaje: error.message, tipo: 'error' });
        }
    }

    async function resolver(reporte, nuevoEstado, eliminarContenido) {
        if (eliminarContenido && !confirm('¿Eliminar definitivamente el contenido reportado?')) return;
        try {
            await api.adminResolverReporte(reporte.id, nuevoEstado, eliminarContenido);
            setAlerta({ mensaje: 'Reporte actualizado.', tipo: 'ok' });
            await cargar(1);
        } catch (error) {
            setAlerta({ mensaje: error.message, tipo: 'error' });
        }
    }

    return (
        <>
            <Navbar />
            <div className="container" style={{ maxWidth: '960px' }}>
                <main className="main-content">
                    <Alerta mensaje={alerta.mensaje} tipo={alerta.tipo} />

                    <div className="pestanas">
                        <button className={`filtro-btn ${pestana === 'reportes' ? 'activo' : ''}`} onClick={() => setPestana('reportes')}>Reportes</button>
                        <button className={`filtro-btn ${pestana === 'auditoria' ? 'activo' : ''}`} onClick={() => setPestana('auditoria')}>Auditoria</button>
                    </div>

                    {pestana === 'reportes' && (
                        <div className="box">
                            <div className="box-header">PANEL DE MODERACION</div>
                            <div className="box-body">
                                <div className="form-group" style={{ maxWidth: '220px' }}>
                                    <label htmlFor="estado">Estado</label>
                                    <select id="estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
                                        <option value="pendiente">Pendientes</option>
                                        <option value="revisado">Revisados</option>
                                        <option value="descartado">Descartados</option>
                                        <option value="">Todos</option>
                                    </select>
                                </div>

                                {reportes.length === 0 && <p style={{ color: 'var(--gris-medio)' }}>No hay reportes en este estado.</p>}

                                {reportes.map((r) => (
                                    <div key={r.id} className="reporte">
                                        <div className="reporte-cabecera">
                                            <strong>#{r.id} · {r.tipo === 'post' ? 'Publicacion' : 'Comentario'}</strong>
                                            <span className={`estado-reporte estado-${r.estado}`}>{r.estado}</span>
                                        </div>
                                        <small>
                                            Motivo: <strong>{MOTIVOS[r.motivo]}</strong> · reportado por @{r.reportante.username} · {formatearFecha(r.fecha)}
                                        </small>
                                        {r.descripcion && <p className="reporte-desc">“{r.descripcion}”</p>}

                                        {r.contenidoEliminado ? (
                                            <p><em>El contenido reportado ya fue eliminado.</em></p>
                                        ) : (
                                            <div className="reporte-contenido">
                                                {r.contenido.titulo && <strong>{r.contenido.titulo}</strong>}
                                                <div style={{ whiteSpace: 'pre-wrap' }}>{r.contenido.texto}</div>
                                                <small>
                                                    Autor real: <strong>@{r.autorReal.username}</strong> ({r.autorReal.nombre})
                                                    {r.contenido.esAnonimo && ' · publicacion anónima'}
                                                    {' · '}
                                                    <Link to={`/post/${r.tipo === 'post' ? r.contenido.id : r.contenido.postId}`}>Ver en el foro</Link>
                                                </small>
                                            </div>
                                        )}

                                        {r.estado === 'pendiente' && (
                                            <div className="reporte-acciones">
                                                <button className="btn btn-sm btn-secundario" onClick={() => resolver(r, 'descartado', false)}>Descartar</button>
                                                <button className="btn btn-sm btn-primary" onClick={() => resolver(r, 'revisado', false)}>Marcar revisado</button>
                                                {!r.contenidoEliminado && (
                                                    <button className="btn btn-sm btn-danger" onClick={() => resolver(r, 'revisado', true)}>Revisar y eliminar contenido</button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {paginacion.page < paginacion.paginas && (
                                    <button className="btn btn-sm btn-primary" onClick={() => cargar(paginacion.page + 1)}>Cargar mas</button>
                                )}
                            </div>
                        </div>
                    )}

                    {pestana === 'auditoria' && (
                        <div className="box">
                            <div className="box-header">REGISTRO DE AUDITORIA</div>
                            <div className="box-body" style={{ overflowX: 'auto' }}>
                                <table className="tabla">
                                    <thead>
                                        <tr><th>Fecha</th><th>Admin</th><th>Accion</th><th>Entidad</th><th>Detalle</th></tr>
                                    </thead>
                                    <tbody>
                                        {registros.map((a) => (
                                            <tr key={a.id}>
                                                <td>{formatearFecha(a.fecha)}</td>
                                                <td>@{a.admin}</td>
                                                <td>{a.accion}</td>
                                                <td>{a.entidad} #{a.entidadId}</td>
                                                <td>{a.detalle}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {registros.length === 0 && <p style={{ color: 'var(--gris-medio)' }}>Aun no hay acciones registradas.</p>}
                                {paginacion.page < paginacion.paginas && (
                                    <button className="btn btn-sm btn-primary" style={{ marginTop: '8px' }} onClick={() => cargar(paginacion.page + 1)}>Cargar mas</button>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
