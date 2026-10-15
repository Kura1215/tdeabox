import { Link } from 'react-router-dom';

// Autor de un post. Si es anonimo la API no manda usuarioId: se muestra "Anónimo" sin enlace.
// El admin recibe ademas autorReal y lo ve entre parentesis.
export default function AutorPost({ item }) {
    if (item.usuarioId === null || item.usuarioId === undefined) {
        return (
            <>
                <strong>{item.nombreUsuario || 'Anónimo'}</strong>
                {item.autorReal && <span className="autor-real"> (admin: @{item.autorReal.username})</span>}
            </>
        );
    }
    return (
        <>
            <Link to={`/usuario/${item.usuarioId}`}>
                <strong>{item.nombreUsuario || item.usernameUsuario}</strong>
            </Link> (@{item.usernameUsuario})
        </>
    );
}
