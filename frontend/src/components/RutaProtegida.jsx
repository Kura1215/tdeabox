import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// bloquea el paso a las paginas que necesitan sesion iniciada
export default function RutaProtegida({ children }) {
    const { usuario } = useAuth();

    if (!usuario) {
        return <Navigate to="/" replace />;
    }

    return children;
}
