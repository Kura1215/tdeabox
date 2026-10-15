// Prueba de carga (RNF02): 200 conexiones concurrentes contra los endpoints mas usados.
// Requisitos: `node scripts/seed-carga.js`, y el servidor corriendo con DB_NAME=tdeavox_carga (y AUTH_RATE_MAX alto).
// Uso: node scripts/carga.js [urlBase] [segundos]
const autocannon = require('autocannon');

const base = process.argv[2] || 'http://localhost:8080';
const duracion = Number(process.argv[3]) || 20;

async function login() {
    const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: 'usuario_1@tdea.edu.co', password: 'clave1234' })
    });
    return (await res.json()).token;
}

function medir(titulo, opciones) {
    return new Promise((resolve) => {
        autocannon({ url: base, connections: 200, duration: duracion, ...opciones }, (err, r) => {
            if (err) throw err;
            console.log(`\n${titulo}`);
            console.log(`  req/s: ${r.requests.average} | latencia p50: ${r.latency.p50} ms | p97.5: ${r.latency.p97_5} ms | p99: ${r.latency.p99} ms | max: ${r.latency.max} ms`);
            console.log(`  2xx: ${r['2xx']} | no-2xx: ${r.non2xx} | errores: ${r.errors} | timeouts: ${r.timeouts}`);
            resolve(r);
        });
    });
}

(async () => {
    const token = await login();
    const headers = { Authorization: `Bearer ${token}` };

    await medir('Feed (pagina 1, anonimo)', { requests: [{ path: '/api/posts?limit=10' }] });
    await medir('Feed con sesion', { headers, requests: [{ path: '/api/posts?limit=20&page=3' }] });
    await medir('Busqueda FULLTEXT', { headers, requests: [{ path: '/api/posts?q=calculo+parcial' }] });
    await medir('Solo de quienes sigo', { headers, requests: [{ path: '/api/posts?siguiendo=true' }] });
    await medir('Ranking semanal', { headers, requests: [{ path: '/api/posts/ranking-semanal' }] });
    await medir('Detalle de post', { headers, requests: [{ path: '/api/posts/30000' }] });
    await medir('Comentarios de un post', { headers, requests: [{ path: '/api/posts/30000/comentarios' }] });
})();
