// ============================================================
// rendimiento.js — Módulo de Técnicos (Rediseñado)
// ============================================================
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBtk3JluulZMZrofKnNA6aNn0usR6of83Y",
    authDomain: "kpi-atenciones.firebaseapp.com",
    projectId: "kpi-atenciones",
    storageBucket: "kpi-atenciones.firebasestorage.app",
    messagingSenderId: "502007721687",
    appId: "1:502007721687:web:c5368c8ea72bb832fdca92"
};

const app = getApps().find(a => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAIL = 'julio.orozco@sonda.com';
const META_DIARIA = 10;
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const TECNICOS = {
    'julio.orozco@sonda.com': { nombre: 'Julio Cesar Orozco Evangelista', alias: 'JULIO A.VIP', tag: 'VIP', color: '#FF6600' },
    'kevi.inga@sonda.com': { nombre: 'Inga Rojas, Kevin Anibal', alias: 'KEVIN A.INC', tag: 'INC', color: '#6366f1' },
    'yumich.cordero@sonda.com': { nombre: 'Cordero Eyzaguirre, Yumich', alias: 'YUMICH A.REQ', tag: 'REQ', color: '#10b981' },
};

const chartInstances = {};

// ── Helpers ────────────────────────────────────────────────────
function hoyPeru() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
}

function parseFecha(s) {
    if (!s) return null;
    const p = s.split('/');
    return p.length === 3 ? new Date(+p[2], +p[1] - 1, +p[0]) : null;
}

function diffMinutos(hi, hf) {
    if (!hi || !hf || !hi.includes(':') || !hf.includes(':')) return null;
    const [hI, mI] = hi.split(':').map(Number);
    const [hF, mF] = hf.split(':').map(Number);
    const d = (hF * 60 + mF) - (hI * 60 + mI);
    return d > 0 ? d : null;
}

function calcSLA(tks) {
    const v = tks.filter(t => diffMinutos(t.horaInicio, t.horaFin) !== null);
    if (!v.length) return 0;
    return Math.round(v.filter(t => diffMinutos(t.horaInicio, t.horaFin) < 120).length / v.length * 100);
}

function promMinutos(tks) {
    const v = tks.map(t => diffMinutos(t.horaInicio, t.horaFin)).filter(x => x !== null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
}

const esHoy = (f, ahora) => f.toDateString() === ahora.toDateString();
const esMesAct = (f, ahora) => f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
const esAnio = (f, ahora) => f.getFullYear() === ahora.getFullYear();

function filtrarHoy(tks, ahora) { return tks.filter(t => { const f = parseFecha(t.fecha); return f && esHoy(f, ahora); }); }
function filtrarMesAct(tks, ahora) { return tks.filter(t => { const f = parseFecha(t.fecha); return f && esMesAct(f, ahora); }); }
function filtrarAnio(tks, ahora) { return tks.filter(t => { const f = parseFecha(t.fecha); return f && esAnio(f, ahora); }); }
function filtrarMes(tks, anio, mes) { return tks.filter(t => { const f = parseFecha(t.fecha); return f && f.getFullYear() === anio && f.getMonth() === mes; }); }

function ticketsPorSemana(tks) {
    const s = [0, 0, 0, 0];
    tks.forEach(t => {
        const f = parseFecha(t.fecha);
        if (f) s[Math.min(3, Math.ceil(f.getDate() / 7) - 1)]++;
    });
    return s;
}

function mesesDisponibles(tks) {
    const set = new Set();
    tks.forEach(t => { const f = parseFecha(t.fecha); if (f) set.add(`${f.getFullYear()}-${String(f.getMonth()).padStart(2, '0')}`); });
    return Array.from(set).sort().map(k => {
        const [y, m] = k.split('-').map(Number);
        return { anio: y, mes: m, label: `${MESES[m]} ${y}` };
    });
}

// ── HTML de la tarjeta ─────────────────────────────────────────
function renderTarjeta(tec, tickets) {
    const ahora = hoyPeru();
    const hoy = filtrarHoy(tickets, ahora);
    const pct = Math.min(100, Math.round((hoy.length / META_DIARIA) * 100));

    return `
    <div class="corp-card" id="card-${tec.tag}">

        <div class="corp-header">
            <div class="corp-avatar" style="background:${tec.color}20; border:2px solid ${tec.color};">
                <span style="color:${tec.color}; font-weight:800; font-size:0.85rem;">${tec.tag}</span>
            </div>
            <div class="corp-identity">
                <p class="corp-nombre">${tec.nombre}</p>
                <p class="corp-cargo" style="color:${tec.color}">${tec.alias}</p>
            </div>
        </div>

        <div class="corp-kpis" id="kpis-${tec.tag}"></div>

        <div class="corp-progreso-section">
            <div class="corp-progreso-label">
                <span>Meta diaria</span>
                <span id="pct-${tec.tag}" style="color:${tec.color}; font-weight:700;">${pct}% · ${hoy.length}/${META_DIARIA} tickets</span>
            </div>
            <div class="corp-progreso-bar">
                <div class="corp-progreso-fill" id="fill-${tec.tag}"
                    style="width:${pct}%; background:linear-gradient(90deg,${tec.color}aa,${tec.color}); transition:width 0.8s ease;">
                </div>
            </div>
        </div>

        <!-- Distribución + Comparación mensual -->
        <div class="corp-bottom">
            <div class="corp-dona-wrap">
                <canvas id="dona-${tec.tag}" width="130" height="130"></canvas>
                <p class="corp-dona-label">Distribución<br><small style="color:#334155">mes actual</small></p>
            </div>
            <div class="corp-comp-wrap">
                <p class="corp-comp-titulo">Comparar meses</p>
                <div class="corp-comp-selects">
                    <select class="corp-mes-sel" id="mesA-${tec.tag}"></select>
                    <span class="corp-vs">vs</span>
                    <select class="corp-mes-sel" id="mesB-${tec.tag}"></select>
                </div>
                <div class="corp-comp-resumen" id="resumen-${tec.tag}"></div>
                <canvas id="comp-${tec.tag}"></canvas>
            </div>
        </div>

    </div>`;
}

// ── Actualizar KPIs y dona ─────────────────────────────────────
function actualizarTarjeta(tec, tickets) {
    const ahora = hoyPeru();
    const hoy = filtrarHoy(tickets, ahora);
    const mesAct = filtrarMesAct(tickets, ahora);
    const anual = filtrarAnio(tickets, ahora);

    const kpisEl = document.getElementById(`kpis-${tec.tag}`);
    if (kpisEl) {
        const prom = promMinutos(mesAct);
        const sla = calcSLA(mesAct);
        const slaColor = sla >= 90 ? '#10b981' : sla >= 70 ? '#f59e0b' : '#ef4444';
        kpisEl.innerHTML = `
            <div class="corp-kpi">
                <span class="corp-kpi-val">${hoy.length}</span>
                <span class="corp-kpi-lab">Tickets hoy</span>
            </div>
            <div class="corp-kpi-divider"></div>
            <div class="corp-kpi">
                <span class="corp-kpi-val">${prom}<small>min</small></span>
                <span class="corp-kpi-lab">T. promedio</span>
            </div>
            <div class="corp-kpi-divider"></div>
            <div class="corp-kpi">
                <span class="corp-kpi-val" style="color:${slaColor}">${sla}%</span>
                <span class="corp-kpi-lab">SLA</span>
            </div>
            <div class="corp-kpi-divider"></div>
            <div class="corp-kpi">
                <span class="corp-kpi-val" style="color:#f59e0b">${anual.length}</span>
                <span class="corp-kpi-lab">Histórico ${ahora.getFullYear()}</span>
            </div>`;
    }

    // Meta diaria
    const pct = Math.min(100, Math.round((hoy.length / META_DIARIA) * 100));
    const fillEl = document.getElementById(`fill-${tec.tag}`);
    const pctEl = document.getElementById(`pct-${tec.tag}`);
    if (fillEl) fillEl.style.width = pct + '%';
    if (pctEl) pctEl.textContent = `${pct}% · ${hoy.length}/${META_DIARIA} tickets`;

    // Dona — distribución mes actual
    const req = mesAct.filter(t => (t.tipo || '').toUpperCase().includes('REQUER')).length;
    const inc = mesAct.filter(t => (t.tipo || '').toUpperCase().includes('INCID')).length;
    actualizarDona(tec.tag, req, inc, tec.color);
}

// ── Comparación mensual ────────────────────────────────────────
function inicializarComparacion(tec, tickets) {
    const meses = mesesDisponibles(tickets);
    const selA = document.getElementById(`mesA-${tec.tag}`);
    const selB = document.getElementById(`mesB-${tec.tag}`);
    if (!selA || !selB) return;

    if (meses.length === 0) {
        selA.innerHTML = selB.innerHTML = '<option>Sin datos</option>';
        return;
    }

    const opts = meses.map((m, i) => `<option value="${i}">${m.label}</option>`).join('');
    selA.innerHTML = selB.innerHTML = opts;

    // Por defecto: mes anterior vs mes actual
    selA.value = Math.max(0, meses.length - 2);
    selB.value = meses.length - 1;

    const render = () => actualizarComparacion(tec, tickets, meses);
    selA.addEventListener('change', render);
    selB.addEventListener('change', render);
    render();
}

function actualizarComparacion(tec, tickets, meses) {
    const selA = document.getElementById(`mesA-${tec.tag}`);
    const selB = document.getElementById(`mesB-${tec.tag}`);
    if (!selA || !selB) return;

    const mA = meses[+selA.value];
    const mB = meses[+selB.value];
    if (!mA || !mB) return;

    const tksA = filtrarMes(tickets, mA.anio, mA.mes);
    const tksB = filtrarMes(tickets, mB.anio, mB.mes);

    // Resumen comparativo
    const resEl = document.getElementById(`resumen-${tec.tag}`);
    if (resEl) {
        const slaA = calcSLA(tksA), slaB = calcSLA(tksB);
        const promA = promMinutos(tksA), promB = promMinutos(tksB);
        const dVol = tksB.length - tksA.length;
        const dSla = slaB - slaA;
        const dProm = promB - promA;

        const tag = (val, invert = false) => {
            if (val === 0) return `<span style="color:#64748b">= Sin cambio</span>`;
            const mejor = invert ? val < 0 : val > 0;
            const color = mejor ? '#10b981' : '#ef4444';
            const flecha = mejor ? '▲' : '▼';
            return `<span style="color:${color}">${flecha} ${val > 0 ? '+' : ''}${val}</span>`;
        };

        resEl.innerHTML = `
            <div class="comp-res-row">
                <span>Tickets</span>
                <span>${tksA.length} → <strong>${tksB.length}</strong></span>
                ${tag(dVol)}
            </div>
            <div class="comp-res-row">
                <span>SLA</span>
                <span>${slaA}% → <strong>${slaB}%</strong></span>
                ${tag(dSla)}
            </div>
            <div class="comp-res-row">
                <span>T. prom.</span>
                <span>${promA}min → <strong>${promB}min</strong></span>
                ${tag(dProm, true)}
            </div>`;
    }

    // Gráfico barras por semana
    const ctx = document.getElementById(`comp-${tec.tag}`);
    if (!ctx) return;
    if (chartInstances[`comp-${tec.tag}`]) chartInstances[`comp-${tec.tag}`].destroy();

    chartInstances[`comp-${tec.tag}`] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
            datasets: [
                {
                    label: mA.label,
                    data: ticketsPorSemana(tksA),
                    backgroundColor: tec.color + '55',
                    borderColor: tec.color,
                    borderWidth: 2,
                    borderRadius: 6,
                },
                {
                    label: mB.label,
                    data: ticketsPorSemana(tksB),
                    backgroundColor: '#33415580',
                    borderColor: '#64748b',
                    borderWidth: 2,
                    borderRadius: 6,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top', labels: { color: '#94a3b8', font: { size: 10 }, padding: 10 } }
            },
            scales: {
                x: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
                y: { ticks: { color: '#64748b', stepSize: 1 }, grid: { color: '#1e293b' }, beginAtZero: true }
            }
        }
    });
}

// ── Dona ───────────────────────────────────────────────────────
function actualizarDona(tag, req, inc, color) {
    const ctx = document.getElementById(`dona-${tag}`);
    if (!ctx) return;
    if (chartInstances[`dona-${tag}`]) chartInstances[`dona-${tag}`].destroy();
    const total = req + inc || 1;
    chartInstances[`dona-${tag}`] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [`REQ ${Math.round(req / total * 100)}%`, `INC ${Math.round(inc / total * 100)}%`],
            datasets: [{ data: [req || 0.01, inc || 0.01], backgroundColor: [color, '#334155'], borderWidth: 0 }]
        },
        options: {
            cutout: '72%',
            responsive: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 }, padding: 8 } } }
        }
    });
}

// ── Render principal ───────────────────────────────────────────
function renderModulo(user, tickets) {
    const email = user.email.toLowerCase();
    const esAdmin = email === ADMIN_EMAIL;
    const contenedor = document.getElementById('rendimiento-container');
    if (!contenedor) return;
    contenedor.style.width = '100%';
    contenedor.style.boxSizing = 'border-box';
    contenedor.style.overflow = 'hidden';

    const lista = esAdmin
        ? Object.entries(TECNICOS).map(([e, t]) => ({ email: e, ...t }))
        : (TECNICOS[email] ? [{ email, ...TECNICOS[email] }] : []);

    const grid = esAdmin ? 'corp-grid-admin' : 'corp-grid-solo';
    const soloStyle = !esAdmin ? 'style="width:100%; max-width:100%; box-sizing:border-box;"' : '';
    contenedor.innerHTML = `<div class="corp-grid ${grid}" ${soloStyle}>
        ${lista.map(t => renderTarjeta(t, tickets.filter(tk => tk.tecnico === t.alias))).join('')}
    </div>`;

    lista.forEach(tec => {
        const misTks = tickets.filter(tk => tk.tecnico === tec.alias);
        actualizarTarjeta(tec, misTks);
        inicializarComparacion(tec, misTks);
    });
}

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (!user) return;
        const q = query(collection(db, 'tickets'), orderBy('creadoEn', 'desc'));
        onSnapshot(q, snap => {
            renderModulo(user, snap.docs.map(d => d.data()));
        });
    });
});