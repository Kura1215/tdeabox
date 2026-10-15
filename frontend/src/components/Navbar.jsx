import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { aplicarTema } from '../utils';

export default function Navbar() {
    const { usuario, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [noLeidas, setNoLeidas] = useState(0);
    const [tema, setTema] = useState(document.documentElement.getAttribute('data-tema') || 'claro');

    // contador de notificaciones: al cambiar de pagina y cada minuto
    useEffect(() => {
        let activo = true;
        function consultar() {
            api.contarNoLeidas().then((d) => activo && setNoLeidas(d.noLeidas)).catch(() => {});
        }
        consultar();
        const intervalo = setInterval(consultar, 60000);
        return () => { activo = false; clearInterval(intervalo); };
    }, [location.pathname]);

    function handleLogout(e) {
        e.preventDefault();
        logout();
        navigate('/');
    }

    function cambiarTema() {
        const nuevo = tema === 'oscuro' ? 'claro' : 'oscuro';
        aplicarTema(nuevo);
        setTema(nuevo);
    }

    function esActiva(ruta) {
        return location.pathname === ruta ? 'activo' : '';
    }

    return (
        <nav>
            <Link to="/feed" className="nav-logo">Tdea<span>Vox</span></Link>
            <div className="nav-links">
                <Link to="/feed" className={esActiva('/feed')}>Inicio</Link>
                <Link to="/ranking" className={esActiva('/ranking')}>Ranking</Link>
                <Link to="/crear-post" className={esActiva('/crear-post')}>Crear Post</Link>
                <Link to="/notificaciones" className={esActiva('/notificaciones')}>
                    Notificaciones{noLeidas > 0 && <span className="contador-notif">{noLeidas}</span>}
                </Link>
                <Link to="/perfil" className={esActiva('/perfil')}>Mi Perfil</Link>
                {usuario?.rol === 'admin' && <Link to="/admin" className={esActiva('/admin')}>Admin</Link>}
                <a href="#" onClick={(e) => { e.preventDefault(); cambiarTema(); }}>
                    {tema === 'oscuro' ? '☀ Claro' : '🌙 Oscuro'}
                </a>
                <a href="#" onClick={handleLogout}>Cerrar Sesion</a>
            </div>
        </nav>
    );
}
