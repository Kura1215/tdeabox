import { Link } from 'react-router-dom';
import { API_URL } from '../api';
import { DEFAULT_AVATAR } from '../utils';

// tarjeta con la foto y datos del usuario logueado, se repite en varias paginas
export default function SidebarPerfil({ nombre, username, fotoPerfil, mostrarEditar }) {
    const avatarSrc = fotoPerfil ? `${API_URL}${fotoPerfil}` : DEFAULT_AVATAR;

    return (
        <div className="box sidebar-widget">
            <div className="box-header">MI PERFIL</div>
            <div className="box-body">
                <div className="user-info">
                    <img src={avatarSrc} alt="Foto de perfil" className="avatar-img" />
                    <h4>{nombre || 'Cargando...'}</h4>
                    <p>@{username || 'usuario'}</p>
                    {mostrarEditar && (
                        <Link to="/perfil" className="btn btn-primary btn-sm" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                            Editar Perfil
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
