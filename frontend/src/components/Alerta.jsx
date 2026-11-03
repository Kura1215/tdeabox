export default function Alerta({ mensaje, tipo }) {
    if (!mensaje) return null;

    const clase = tipo === 'ok' ? 'alerta alerta-ok' : 'alerta alerta-error';

    return <div className={clase}>{mensaje}</div>;
}
