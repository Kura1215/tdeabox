import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import SidebarPerfil from '../components/SidebarPerfil';
import Alerta from '../components/Alerta';

export default function CrearPost() {
    const { usuario } = useAuth();
    const navigate = useNavigate();

    const [categorias, setCategorias] = useState([]);
    const [titulo, setTitulo] = useState('');
    const [categoriaId, setCategoriaId] = useState('');
    const [contenido, setContenido] = useState('');
    const [imagen, setImagen] = useState(null);
    const [enviando, setEnviando] = useState(false);
    const [alerta, setAlerta] = useState({ mensaje: '', tipo: '' });
    const inputImagenRef = useRef(null);

    useEffect(() => {
        api.listarCategorias()
            .then(setCategorias)
            .catch(() => setAlerta({ mensaje: 'No se pudieron obtener las categorias desde el servidor.', tipo: 'error' }));
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        setAlerta({ mensaje: '', tipo: '' });

        if (!titulo.trim() || !categoriaId || !contenido.trim()) {
            setAlerta({ mensaje: 'Por favor, completa todos los campos obligatorios del formulario.', tipo: 'error' });
            return;
        }

        const formData = new FormData();
        formData.append('titulo', titulo.trim());
        formData.append('categoriaId', categoriaId);
        formData.append('contenido', contenido.trim());

        if (imagen) {
            formData.append('imagen', imagen);
        }

        try {
            setEnviando(true);
            await api.crearPost(formData);
            setAlerta({ mensaje: '¡Publicacion creada exitosamente! Redirigiendo al feed...', tipo: 'ok' });

            setTimeout(() => {
                navigate('/feed');
            }, 1000);
        } catch (error) {
            setAlerta({ mensaje: error.message || 'Error al intentar registrar la publicacion.', tipo: 'error' });
            setEnviando(false);
        }
    }

    return (
        <>
            <Navbar />
            <div className="container">
                <aside className="sidebar">
                    <div className="sidebar-widget">
                        <button className="btn btn-primary" style={{ display: 'block', width: '100%', textAlign: 'center', marginBottom: '12px' }}
                            onClick={() => navigate('/feed')}>
                            ◀ Volver al Feed
                        </button>
                    </div>
                    <SidebarPerfil nombre={usuario?.nombre} username={usuario?.username} fotoPerfil={usuario?.fotoPerfil} />
                </aside>

                <main className="main-content">
                    <Alerta mensaje={alerta.mensaje} tipo={alerta.tipo} />

                    <div className="box">
                        <div className="box-header">NUEVA PUBLICACION</div>
                        <div className="box-body">
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label htmlFor="post-title">Titulo de la Publicacion</label>
                                    <input type="text" id="post-title" placeholder="Escribe un titulo descriptivo y claro..."
                                        value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="post-category">Categoria</label>
                                    <select id="post-category" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required>
                                        <option value="" disabled>Selecciona una categoria...</option>
                                        {categorias.map((cat) => (
                                            <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="post-content">Contenido / Descripcion</label>
                                    <textarea id="post-content" rows="6" placeholder="Describe a detalle tu duda academica, detalles de objetos perdidos o informacion de interes sobre el campus..."
                                        value={contenido} onChange={(e) => setContenido(e.target.value)} required />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="post-image">Adjuntar Imagen (Opcional)</label>
                                    <input type="file" id="post-image" accept="image/*" ref={inputImagenRef}
                                        onChange={(e) => setImagen(e.target.files[0] || null)} />
                                </div>

                                <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }} disabled={enviando}>
                                    {enviando ? 'Publicando...' : 'Publicar en el Foro'}
                                </button>
                            </form>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
