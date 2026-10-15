import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import SidebarPerfil from '../components/SidebarPerfil';
import Alerta from '../components/Alerta';

// Crea una publicacion o, si la ruta trae :id, edita una existente (solo su autor)
export default function CrearPost() {
    const { id } = useParams();
    const editando = Boolean(id);
    const { usuario } = useAuth();
    const navigate = useNavigate();

    const [categorias, setCategorias] = useState([]);
    const [titulo, setTitulo] = useState('');
    const [categoriaId, setCategoriaId] = useState('');
    const [contenido, setContenido] = useState('');
    const [tags, setTags] = useState('');
    const [esAnonimo, setEsAnonimo] = useState(false);
    const [imagen, setImagen] = useState(null);
    const [enviando, setEnviando] = useState(false);
    const [alerta, setAlerta] = useState({ mensaje: '', tipo: '' });
    const inputImagenRef = useRef(null);

    useEffect(() => {
        api.listarCategorias()
            .then(setCategorias)
            .catch(() => setAlerta({ mensaje: 'No se pudieron obtener las categorias desde el servidor.', tipo: 'error' }));
    }, []);

    useEffect(() => {
        if (!editando) return;
        api.verPost(id)
            .then((post) => {
                if (!post.esMio) {
                    navigate('/feed');
                    return;
                }
                setTitulo(post.titulo);
                setContenido(post.contenido);
                setCategoriaId(String(post.categoriaId));
                setTags(post.tags.join(', '));
            })
            .catch(() => setAlerta({ mensaje: 'No se pudo cargar la publicacion.', tipo: 'error' }));
    }, [id, editando, navigate]);

    async function handleSubmit(e) {
        e.preventDefault();
        setAlerta({ mensaje: '', tipo: '' });

        if (!titulo.trim() || !categoriaId || !contenido.trim()) {
            setAlerta({ mensaje: 'Por favor, completa todos los campos obligatorios del formulario.', tipo: 'error' });
            return;
        }

        const lista = tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
        if (lista.length > 3) {
            setAlerta({ mensaje: 'Puedes usar maximo 3 etiquetas.', tipo: 'error' });
            return;
        }
        if (lista.some((t) => /\s/.test(t) || t.length > 30)) {
            setAlerta({ mensaje: 'Cada etiqueta es una sola palabra de maximo 30 caracteres. Separalas con comas.', tipo: 'error' });
            return;
        }

        const formData = new FormData();
        formData.append('titulo', titulo.trim());
        formData.append('categoriaId', categoriaId);
        formData.append('contenido', contenido.trim());
        formData.append('tags', JSON.stringify(lista));
        if (!editando) formData.append('esAnonimo', esAnonimo ? 'true' : 'false');
        if (imagen) formData.append('imagen', imagen);

        try {
            setEnviando(true);
            if (editando) {
                await api.editarPost(id, formData);
            } else {
                await api.crearPost(formData);
            }
            setAlerta({ mensaje: editando ? '¡Publicacion actualizada!' : '¡Publicacion creada exitosamente! Redirigiendo al feed...', tipo: 'ok' });

            setTimeout(() => {
                navigate(editando ? `/post/${id}` : '/feed');
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
                        <div className="box-header">{editando ? 'EDITAR PUBLICACION' : 'NUEVA PUBLICACION'}</div>
                        <div className="box-body">
                            <form onSubmit={handleSubmit}>
                                <div className="form-group">
                                    <label htmlFor="post-title">Titulo de la Publicacion</label>
                                    <input type="text" id="post-title" maxLength={120} placeholder="Escribe un titulo descriptivo y claro..."
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
                                    <label htmlFor="post-content">Contenido / Descripcion (puedes mencionar con @usuario)</label>
                                    <textarea id="post-content" rows="6" maxLength={3000} placeholder="Describe a detalle tu duda academica, detalles de objetos perdidos o informacion de interes sobre el campus..."
                                        value={contenido} onChange={(e) => setContenido(e.target.value)} required />
                                    <small className="ayuda">{contenido.length}/3000</small>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="post-tags">Etiquetas (hasta 3, separadas por comas, sin espacios)</label>
                                    <input type="text" id="post-tags" placeholder="parcial, calculo, monitoria"
                                        value={tags} onChange={(e) => setTags(e.target.value)} />
                                </div>

                                {!editando && (
                                    <div className="form-group">
                                        <label className="check">
                                            <input type="checkbox" checked={esAnonimo} onChange={(e) => setEsAnonimo(e.target.checked)} />
                                            Publicar como anónimo (otros usuarios no veran quien eres; no se puede cambiar despues)
                                        </label>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label htmlFor="post-image">
                                        {editando ? 'Reemplazar imagen' : 'Adjuntar Imagen'} (Opcional, JPG/PNG/WEBP/GIF, max. 5 MB)
                                    </label>
                                    <input type="file" id="post-image" accept="image/jpeg,image/png,image/webp,image/gif" ref={inputImagenRef}
                                        onChange={(e) => setImagen(e.target.files[0] || null)} />
                                </div>

                                <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }} disabled={enviando}>
                                    {enviando ? 'Guardando...' : editando ? 'Guardar Cambios' : 'Publicar en el Foro'}
                                </button>
                            </form>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
