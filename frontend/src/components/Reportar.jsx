import { useState } from 'react';
import { api } from '../api';

// boton "Reportar" que abre un formulario pequeño (RF08)
export default function Reportar({ tipo, id }) {
    const [abierto, setAbierto] = useState(false);
    const [motivo, setMotivo] = useState('spam');
    const [descripcion, setDescripcion] = useState('');
    const [estado, setEstado] = useState({ mensaje: '', tipo: '' });

    async function enviar(e) {
        e.preventDefault();
        if (motivo === 'otro' && !descripcion.trim()) {
            setEstado({ mensaje: 'Describe el motivo del reporte.', tipo: 'error' });
            return;
        }
        try {
            await api.reportar(tipo, id, motivo, descripcion.trim());
            setEstado({ mensaje: 'Reporte enviado. ¡Gracias!', tipo: 'ok' });
            setAbierto(false);
        } catch (error) {
            setEstado({ mensaje: error.message, tipo: 'error' });
        }
    }

    return (
        <span className="reportar">
            {!abierto && (
                <button className="btn btn-sm btn-secundario" onClick={() => { setEstado({ mensaje: '', tipo: '' }); setAbierto(true); }}>
                    ⚑ Reportar
                </button>
            )}
            {estado.mensaje && <span className={estado.tipo === 'ok' ? 'texto-ok' : 'texto-error'}> {estado.mensaje}</span>}
            {abierto && (
                <form onSubmit={enviar} className="form-reporte">
                    <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                        <option value="spam">Spam</option>
                        <option value="contenido_inapropiado">Contenido inapropiado</option>
                        <option value="otro">Otro</option>
                    </select>
                    {motivo === 'otro' && (
                        <textarea rows="2" maxLength={300} placeholder="Describe el problema (max. 300)"
                            value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
                    )}
                    <div>
                        <button type="submit" className="btn btn-danger btn-sm">Enviar reporte</button>{' '}
                        <button type="button" className="btn btn-sm btn-secundario" onClick={() => setAbierto(false)}>Cancelar</button>
                    </div>
                </form>
            )}
        </span>
    );
}
