// ============================================================
// Charts.js — Gráficos del Panel Principal
// Llamado desde script.js tras cargar el CSV
// ============================================================

let chartBarras = null;
let chartDonut = null;

function renderizarPanelPrincipal(textoCsv) {
    const datos = parsearCSV(textoCsv);
    if (!datos) return;
    renderBarras(datos);
    renderDonut(datos);
    renderTabla(datos);
}

function parsearCSV(texto) {
    const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lineas.length <= 1) return null;
    const sep = lineas[0].includes(';') ? ';' : ',';
    const cab = lineas[0].split(sep).map(c => c.trim());
    const idxTecnico = buscarColumna(cab, ['técnico', 'tecnico', 'nombre', 'asignado', 'ejecutado', 'atendido por']);
    const idxTipo = buscarColumna(cab, ['tipo de ticket', 'tipo ticket', 'tipo', 'categoria', 'categoría']);
    const idxInicio = buscarColumna(cab, ['hora de inicio', 'hora inicio', 'inicio']);
    const idxFin = buscarColumna(cab, ['hora de fin', 'hora fin', 'fin']);
    const filas = [];
    for (let i = 1; i < lineas.length; i++) {
        const cols = lineas[i].split(sep).map(c => c.trim());
        if (cols.length < 2) continue;
        filas.push({
            tecnico: idxTecnico >= 0 ? cols[idxTecnico] : 'Sin asignar',
            tipo: idxTipo >= 0 ? cols[idxTipo] : '',
            inicio: idxInicio >= 0 ? cols[idxInicio] : '',
            fin: idxFin >= 0 ? cols[idxFin] : '',
        });
    }
    return { filas };
}

function buscarColumna(cab, candidatos) {
    return cab.findIndex(c => candidatos.some(k => c.toLowerCase().includes(k)));
}

function normalizarTipo(tipo) {
    if (!tipo) return 'Otro';
    const t = tipo.toLowerCase();
    if (t.includes('incidencia') || t.includes('incidente')) return 'Incidencia';
    if (t.includes('requerimiento') || t.includes('requerim')) return 'Requerimiento';
    if (t.includes('mantenimiento') || t.includes('mantenim')) return 'Mantenimiento';
    return tipo || 'Otro';
}

const TECNICOS_VALIDOS = ['JULIO A.VIP', 'KEVIN A.INC', 'YUMICH A.REQ'];

function agregarPorTecnico(filas) {
    const mapa = {};
    // Inicializar siempre los 3 técnicos aunque tengan 0 tickets
    TECNICOS_VALIDOS.forEach(t => { mapa[t] = { Incidencia: 0, Requerimiento: 0, tiempos: [] }; });

    filas.forEach(f => {
        const tec = (f.tecnico || '').toUpperCase().trim();
        if (!TECNICOS_VALIDOS.includes(tec)) return; // ignorar otros
        const tipo = normalizarTipo(f.tipo);
        if (tipo === 'Incidencia' || tipo === 'Requerimiento') {
            mapa[tec][tipo] = (mapa[tec][tipo] || 0) + 1;
        }
        if (f.inicio && f.fin && f.inicio.includes(':') && f.fin.includes(':')) {
            const [hI, mI] = f.inicio.split(':').map(Number);
            const [hF, mF] = f.fin.split(':').map(Number);
            const diff = (hF * 60 + mF) - (hI * 60 + mI);
            if (diff > 0) mapa[tec].tiempos.push(diff);
        }
    });
    return mapa;
}

function renderBarras({ filas }) {
    const mapa = agregarPorTecnico(filas);
    const tecnicos = Object.keys(mapa);
    const ctx = document.getElementById('chart-barras');
    if (!ctx) return;
    if (chartBarras) chartBarras.destroy();
    chartBarras = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: TECNICOS_VALIDOS,
            datasets: [
                { label: 'Requerimientos', data: TECNICOS_VALIDOS.map(t => mapa[t].Requerimiento), backgroundColor: '#4C8BF5' },
                { label: 'Incidencias', data: TECNICOS_VALIDOS.map(t => mapa[t].Incidencia), backgroundColor: '#FF6600' },
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#000000', font: { size: 13 } } } },
            scales: {
                x: { ticks: { color: '#000000' }, grid: { color: '#3c3c3c' } },
                y: { ticks: { color: '#000000' }, grid: { color: '#3c3c3c' }, beginAtZero: true }
            }
        }
    });
}

function renderDonut({ filas }) {
    const c = { Incidencia: 0, Requerimiento: 0 };
    filas.forEach(f => {
        const tec = (f.tecnico || '').toUpperCase().trim();
        if (!TECNICOS_VALIDOS.includes(tec)) return;
        const t = normalizarTipo(f.tipo);
        if (c[t] !== undefined) c[t]++;
    });
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    const pct = k => total > 0 ? Math.round((c[k] / total) * 100) : 0;
    const ctx = document.getElementById('chart-donut');
    if (!ctx) return;
    if (chartDonut) chartDonut.destroy();
    chartDonut = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [`Incidencia ${pct('Incidencia')}%`, `Requerimiento ${pct('Requerimiento')}%`],
            datasets: [{ data: [c.Incidencia, c.Requerimiento], backgroundColor: ['#FF6600', '#4C8BF5'], borderWidth: 2, borderColor: '#2d2d2d' }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '65%',
            plugins: { legend: { position: 'top', labels: { color: '#000000', font: { size: 12 }, padding: 16 } } }
        }
    });
}

function renderTabla({ filas }) {
    const mapa = agregarPorTecnico(filas);
    const contenedor = document.getElementById('tabla-productividad');
    if (!contenedor) return;
    const rows = TECNICOS_VALIDOS.map(nombre => {
        const d = mapa[nombre];
        const total = (d.Incidencia || 0) + (d.Requerimiento || 0);
        const promH = d.tiempos.length > 0 ? (d.tiempos.reduce((a, b) => a + b, 0) / d.tiempos.length / 60).toFixed(1) : '0';
        const slaOk = d.tiempos.filter(t => t < 120).length;
        const sla = d.tiempos.length > 0 ? Math.round((slaOk / d.tiempos.length) * 100) : (total > 0 ? 100 : 0);
        const ini = nombre.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
        const col = colorAvatar(nombre);
        return `<tr class="tabla-fila">
            <td class="tabla-cel-tecnico"><div class="avatar-inline" style="background:${col}">${ini}</div>${nombre}</td>
            <td class="tabla-cel">${total}</td>
            <td class="tabla-cel">${promH}h</td>
            <td class="tabla-cel tabla-sla" style="color:${sla === 100 ? '#22c55e' : '#f97316'}">● ${sla}%</td>
        </tr>`;
    });
    contenedor.innerHTML = `<table class="tabla-productividad">
        <thead><tr>
            <th class="tabla-th">Técnico</th>
            <th class="tabla-th">Tickets</th>
            <th class="tabla-th">T. prom.</th>
            <th class="tabla-th tabla-sla">SLA</th>
        </tr></thead>
        <tbody>${rows.join('')}</tbody>
    </table>`;
}

function colorAvatar(nombre) {
    const cols = ['#4C8BF5', '#FF6600', '#22c55e', '#a855f7', '#ec4899', '#14b8a6'];
    let h = 0;
    for (let i = 0; i < nombre.length; i++) h = nombre.charCodeAt(i) + ((h << 5) - h);
    return cols[Math.abs(h) % cols.length];
}
// ── Entrada desde Firestore (panel-principal.js) ──────────────
function renderizarPanelPrincipalFirestore(tickets) {
    // Convertir tickets de Firestore al formato que esperan las funciones
    const filas = tickets.map(t => ({
        tecnico: t.tecnico || '',
        tipo: t.tipo || '',
        inicio: t.horaInicio || '',
        fin: t.horaFin || '',
    }));
    renderBarras({ filas });
    renderDonut({ filas });
    renderTabla({ filas });
}