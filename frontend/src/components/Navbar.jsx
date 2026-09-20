import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    function handleLogout(e) {
        e.preventDefault();
        logout();
        navigate('/');
    }

    function esActiva(ruta) {
        return location.pathname === ruta ? 'activo' : '';
    }

    return (
        <nav>
            <Link to="/feed" className="nav-logo">Tdea<span>Vox</span></Link>
            <div className="nav-links">
                <Link to="/crear-post" className={esActiva('/crear-post')}>Crear Post</Link>
                <Link to="/perfil" className={esActiva('/perfil')}>Mi Perfil</Link>
                <a href="#" onClick={handleLogout}>Cerrar Sesion</a>
            </div>
        </nav>
    );
}
