import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, API_URL } from '../api';
import { DEFAULT_AVATAR } from '../utils';

// Botones "Seguidores / Seguidos" que despliegan la lista de usuarios (RF06)
export default function RelacionesUsuario({ usuarioId, seguidores, seguidos }) {
    const [abierta, setAbierta] = useState(null); // 'seguidores' | 'seguidos' | null
    const [lista, setLista] = useState([]);

    async function abrir(tipo) {
        if (abierta === tipo) {
            setAbierta(null);
            return;
        }
        setAbierta(tipo);
        setLista([]);
        try {
            const data = tipo === 'seguidores' ? await api.seguidores(usuarioId) : await api.seguidos(usuarioId);
            setLista(data.usuarios);
        } catch (e) {
            setLista([]);
        }
    }

    return (
        <div>
            <div className="relaciones">
                <button className="btn btn-sm btn-secundario" onClick={() => abrir('seguidores')}>
                    <strong>{seguidores}</strong> seguidores
                </button>
                <button className="btn btn-sm btn-secundario" onClick={() => abrir('seguidos')}>
                    <strong>{seguidos}</strong> seguidos
                </button>
            </div>
            {abierta && (
                <ul className="lista-usuarios">
                    {lista.length === 0 && <li style={{ color: 'var(--gris-medio)' }}>Sin usuarios todavia.</li>}
                    {lista.map((u) => (
                        <li key={u.id}>
                            <img src={u.fotoPerfil ? `${API_URL}${u.fotoPerfil}` : DEFAULT_AVATAR} alt="" className="comentario-avatar" />
                            <Link to={`/usuario/${u.id}`}>{u.nombre} (@{u.username})</Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
