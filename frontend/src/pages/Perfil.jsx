import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import SidebarPerfil from '../components/SidebarPerfil';
import PostCard from '../components/PostCard';
import Alerta from '../components/Alerta';

export default function Perfil() {
    const { usuario, actualizarPerfil } = useAuth();

    const [datos, setDatos] = useState(null);
    const [posts, setPosts] = useState([]);
    const [nombre, setNombre] = useState('');
    const [avatarFile, setAvatarFile] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [alerta, setAlerta] = useState({ mensaje: '', tipo: '' });
    const inputAvatarRef = useRef(null);

    useEffect(() => {
        cargarPerfil();
    }, []);

    async function cargarPerfil() {
        try {
            const data = await api.verPerfil();
            setDatos(data);
            setNombre(data.nombre);
            setPosts(data.posts || []);
            actualizarPerfil(data.nombre, data.fotoPerfil);
        } catch (error) {
            setAlerta({ mensaje: 'No se pudieron obtener los datos de tu cuenta desde el servidor.', tipo: 'error' });
        }
    }

    async function handleGuardar(e) {
        e.preventDefault();
        setAlerta({ mensaje: '', tipo: '' });

        if (!nombre.trim()) {
            setAlerta({ mensaje: 'El nombre completo no puede estar vacio.', tipo: 'error' });
            return;
        }

        const formData = new FormData();
        formData.append('nombre', nombre.trim());

        if (avatarFile) {
            formData.append('foto', avatarFile);
        }

        try {
            setGuardando(true);
            const res = await api.editarPerfil(formData);
            actualizarPerfil(res.nombre, res.fotoPerfil);
            setAlerta({ mensaje: '¡Datos de perfil guardados con exito!', tipo: 'ok' });

            setAvatarFile(null);
            if (inputAvatarRef.current) inputAvatarRef.current.value = '';

            await cargarPerfil();
        } catch (error) {
            setAlerta({ mensaje: error.message || 'Error al intentar actualizar los datos personales.', tipo: 'error' });
        } finally {
            setGuardando(false);
        }
    }

    async function handleEliminarPost(postId) {
        const confirmar = confirm('¿Estas seguro de que deseas eliminar esta publicacion permanentemente? Esta accion borrara todas sus respuestas asociadas.');
        if (!confirmar) return;

        try {
            await api.eliminarPost(postId);
            setAlerta({ mensaje: '¡Publicacion eliminada correctamente!', tipo: 'ok' });
            await cargarPerfil();
        } catch (error) {
            setAlerta({ mensaje: error.message || 'Error al intentar eliminar la publicacion del servidor.', tipo: 'error' });
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
                        <div className="box-header">EDITAR DATOS PERSONALES</div>
                        <div className="box-body">
                            <form onSubmit={handleGuardar}>
                                <div className="form-group">
                                    <label htmlFor="profile-name">Nombre Completo</label>
                                    <input type="text" id="profile-name" placeholder="Tu nombre real..."
                                        value={nombre} onChange={(e) => setNombre(e.target.value)} required />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="profile-username">Nombre de Usuario (Username)</label>
                                    <input type="text" id="profile-username" value={datos?.username || ''} disabled
                                        style={{ backgroundColor: 'var(--gris-claro)', cursor: 'not-allowed' }} />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="profile-email">Correo Institucional</label>
                                    <input type="email" id="profile-email" value={datos?.correo || ''} disabled
                                        style={{ backgroundColor: 'var(--gris-claro)', cursor: 'not-allowed' }} />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="profile-avatar">Actualizar Foto de Perfil (Opcional)</label>
                                    <input type="file" id="profile-avatar" accept="image/*" ref={inputAvatarRef}
                                        onChange={(e) => setAvatarFile(e.target.files[0] || null)} />
                                </div>

                                <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }} disabled={guardando}>
                                    {guardando ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="box">
                        <div className="box-header">MIS PUBLICACIONES PUBLICADAS</div>
                        <div className="box-body" style={{ padding: '10px 10px 2px 10px' }}>
                            {posts.length === 0 && (
                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--gris-medio)', fontFamily: 'Arial, sans-serif' }}>
                                    No has realizado publicaciones en el foro todavia.
                                </div>
                            )}

                            {posts.map((post) => (
                                <PostCard key={post.id} post={post} onEliminar={handleEliminarPost} />
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
