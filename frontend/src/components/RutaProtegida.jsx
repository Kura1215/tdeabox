import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function CargandoSesion() {
    return (
        <p style={{ textAlign: 'center', color: 'var(--gris-medio)', fontFamily: 'Arial, sans-serif', padding: '40px' }}>
            Cargando...
        </p>
    );
}

// bloquea el paso a las paginas que necesitan sesion iniciada
export default function RutaProtegida({ children }) {
    const { usuario, cargando } = useAuth();

    // al recargar, la sesion se recupera con la cookie: esperamos antes de mandar al login
    if (cargando) return <CargandoSesion />;

    if (!usuario) {
        return <Navigate to="/" replace />;
    }

    return children;
}
