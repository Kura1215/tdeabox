import { Routes, Route } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Navigate } from 'react-router-dom';
import RutaProtegida from './components/RutaProtegida';
import Login from './pages/Login';
import Feed from './pages/Feed';
import Perfil from './pages/Perfil';
import Post from './pages/Post';
import CrearPost from './pages/CrearPost';

function PaginaInicio() {
    const { usuario } = useAuth();
    if (usuario) {
        return <Navigate to="/feed" replace />;
    }
    return <Login />;
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<PaginaInicio />} />
            <Route path="/feed" element={<RutaProtegida><Feed /></RutaProtegida>} />
            <Route path="/perfil" element={<RutaProtegida><Perfil /></RutaProtegida>} />
            <Route path="/post/:id" element={<RutaProtegida><Post /></RutaProtegida>} />
            <Route path="/crear-post" element={<RutaProtegida><CrearPost /></RutaProtegida>} />
        </Routes>
    );
}
