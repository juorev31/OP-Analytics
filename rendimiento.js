// ============================================================
// rendimiento.js — Módulo de Técnicos (Diseño Corporativo)
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

const TECNICOS = {
    'julio.orozco@sonda.com': { nombre: 'Julio Cesar Orozco Evangelista', alias: 'JULIO A.VIP', tag: 'VIP', color: '#0ea5e9' },
    'kevi.inga@sonda.com': { nombre: 'Inga Rojas, Kevin Anibal', alias: 'KEVIN A.INC', tag: 'INC', color: '#6366f1' },
    'yumich.cordero@sonda.com': { nombre: 'Cordero Eyzaguirre, Yumich', alias: 'YUMICH A.REQ', tag: 'REQ', color: '#10b981' },
};

// IDs de los charts por técnico
const chartInstances = {};

// ── Helpers ───────────────────────────────────────────────────
function hoyPeru() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
}

function parseFecha(fechaStr) {
    if (!fechaStr) return null;
    const p = fechaStr.split('/');
    if (p.length === 3) return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
    return null;
}

function diffMinutos(hi, hf) {
    if (!hi || !hf || !hi.includes(':') || !hf.includes(':')) return null;
    const [hIn, mIn] = hi.split(':').map(Number);
    const [hFi, mFi] = hf.split(':').map(Number);
    const d = (hFi * 60 + mFi) - (hIn * 60 + mIn);
    return d > 0 ? d : null;
}

function filtrarPeriodo(tickets, filtro, ahora) {
    return tickets.filter(t => {
        const f = parseFecha(t.fecha);
        if (!f) return false;
        if (filtro === 'dia') return f.toDateString() === ahora.toDateString();
        if (filtro === 'semana') return (ahora - f) / (86400000) < 7 && f <= ahora;
        if (filtro === 'mes') return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
        return false;
    });
}

function calcSLA(tickets) {
    const v = tickets.filter(t => diffMinutos(t.horaInicio, t.horaFin) !== null);
    if (!v.length) return 0;
    return Math.round(v.filter(t => diffMinutos(t.horaInicio, t.horaFin) < 120).length / v.length * 100);
}

function promMinutos(tickets) {
    const v = tickets.map(t => diffMinutos(t.horaInicio, t.horaFin)).filter(x => x !== null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
}

// ── Renderizar tarjeta ────────────────────────────────────────
function renderTarjeta(tec, tickets) {
    const ahora = hoyPeru();
    const hoy = filtrarPeriodo(tickets, 'dia', ahora);
    const pct = Math.min(100, Math.round((hoy.length / META_DIARIA) * 100));
    const extra = Math.max(0, hoy.length - META_DIARIA);
    const initials = tec.tag;

    return `
    <div class="corp-card" id="card-${tec.tag}">
        <!-- Header -->
        <div class="corp-header">
            <div class="corp-avatar" style="background:${tec.color}20; border:2px solid ${tec.color};">
                <span style="color:${tec.color}; font-weight:800; font-size:0.85rem;">${initials}</span>
            </div>
            <div class="corp-identity">
                <p class="corp-nombre">${tec.nombre}</p>
                <p class="corp-cargo" style="color:${tec.color}">${tec.alias}</p>
            </div>
            <div class="corp-filtro-wrap">
                <select class="corp-filtro" id="filtro-${tec.tag}">
                    <option value="dia">Hoy</option>
                    <option value="semana">Esta semana</option>
                    <option value="mes" selected>Este mes</option>
                </select>
            </div>
        </div>

        <!-- KPIs principales -->
        <div class="corp-kpis" id="kpis-${tec.tag}"></div>

        <!-- Progreso meta diaria -->
        <div class="corp-progreso-section">
            <div class="corp-progreso-label">
                <span>Meta diaria</span>
                <span id="pct-${tec.tag}" style="color:${tec.color}; font-weight:700;">${pct}% · ${hoy.length}/${META_DIARIA} tickets</span>
            </div>
            <div class="corp-progreso-bar">
                <div class="corp-progreso-fill" id="fill-${tec.tag}"
                    style="width:${pct}%; background: linear-gradient(90deg, ${tec.color}aa, ${tec.color}); transition: width 0.8s ease;">
                </div>
            </div>
            ${extra > 0 ? `<p class="corp-extra" style="color:${tec.color}">+${extra} sobre la meta del día</p>` : ''}
        </div>

        <!-- Gráfico dona + métricas comparativas -->
        <div class="corp-bottom">
            <div class="corp-dona-wrap">
                <canvas id="dona-${tec.tag}" width="140" height="140"></canvas>
                <p class="corp-dona-label">Distribución</p>
            </div>
            <div class="corp-comparativo" id="comp-${tec.tag}"></div>
        </div>
    </div>`;
}

// ── Actualizar datos de una tarjeta ───────────────────────────
function actualizarTarjeta(tec, tickets) {
    const ahora = hoyPeru();
    const filtro = document.getElementById(`filtro-${tec.tag}`)?.value || 'mes';
    const tks = filtrarPeriodo(tickets, filtro, ahora);
    const hoy = filtrarPeriodo(tickets, 'dia', ahora);

    // KPIs
    const kpisEl = document.getElementById(`kpis-${tec.tag}`);
    if (kpisEl) {
        const prom = promMinutos(tks);
        const sla = calcSLA(tks);
        const slaColor = sla >= 90 ? '#10b981' : sla >= 70 ? '#f59e0b' : '#ef4444';
        kpisEl.innerHTML = `
            <div class="corp-kpi">
                <span class="corp-kpi-val">${tks.length}</span>
                <span class="corp-kpi-lab">Tickets</span>
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
                <span class="corp-kpi-val" style="color:#f59e0b">${tickets.length}</span>
                <span class="corp-kpi-lab">Histórico</span>
            </div>`;
    }

    // Meta diaria
    const pct = Math.min(100, Math.round((hoy.length / META_DIARIA) * 100));
    const extra = Math.max(0, hoy.length - META_DIARIA);
    const fillEl = document.getElementById(`fill-${tec.tag}`);
    const pctEl = document.getElementById(`pct-${tec.tag}`);
    if (fillEl) fillEl.style.width = pct + '%';
    if (pctEl) pctEl.textContent = `${pct}% · ${hoy.length}/${META_DIARIA} tickets`;

    // Dona
    const req = tks.filter(t => (t.tipo || '').toUpperCase().includes('REQUER')).length;
    const inc = tks.filter(t => (t.tipo || '').toUpperCase().includes('INCID')).length;
    actualizarDona(tec.tag, req, inc, tec.color);

    // Comparativo periodos
    const compEl = document.getElementById(`comp-${tec.tag}`);
    if (compEl) {
        const tksAnt = getPeriodoAnterior(tickets, filtro, ahora);
        const promAnt = promMinutos(tksAnt);
        const slaAnt = calcSLA(tksAnt);
        const volAnt = tksAnt.length;
        const prom = promMinutos(tks);
        const sla = calcSLA(tks);
        const vol = tks.length;

        compEl.innerHTML = `
            <p class="corp-comp-titulo">Comparativo con periodo anterior</p>
            ${metricaRow('Velocidad', prom, promAnt, 'min', true)}
            ${metricaRow('Volumen', vol, volAnt, 'tickets', false)}
            ${metricaRow('SLA', sla, slaAnt, '%', false)}`;
    }
}

function getPeriodoAnterior(tickets, filtro, ahora) {
    return tickets.filter(t => {
        const f = parseFecha(t.fecha);
        if (!f) return false;
        const diff = (ahora - f) / 86400000;
        if (filtro === 'dia') return diff >= 1 && diff < 2;
        if (filtro === 'semana') return diff >= 7 && diff < 14;
        if (filtro === 'mes') {
            const ant = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
            return f.getMonth() === ant.getMonth() && f.getFullYear() === ant.getFullYear();
        }
        return false;
    });
}

function metricaRow(label, valA, valB, unit, invertido) {
    const diff = valA - valB;
    const mejor = invertido ? diff < 0 : diff > 0;
    const igual = diff === 0;
    const color = igual ? '#64748b' : mejor ? '#10b981' : '#ef4444';
    const flecha = igual ? '→' : mejor ? '▲' : '▼';
    const signo = diff > 0 ? `+${diff}` : `${diff}`;
    return `
        <div class="corp-metrica-row">
            <span class="corp-metrica-label">${label}</span>
            <span class="corp-metrica-vals">${valA}${unit} <span style="color:#475569">vs</span> ${valB}${unit}</span>
            <span class="corp-metrica-diff" style="color:${color}">${flecha} ${signo}${unit}</span>
        </div>`;
}

// ── Chart dona ────────────────────────────────────────────────
function actualizarDona(tag, req, inc, color) {
    const ctx = document.getElementById(`dona-${tag}`);
    if (!ctx) return;
    if (chartInstances[tag]) { chartInstances[tag].destroy(); }
    const total = req + inc || 1;
    chartInstances[tag] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [`REQ ${Math.round(req / total * 100)}%`, `INC ${Math.round(inc / total * 100)}%`],
            datasets: [{
                data: [req || 0.01, inc || 0.01],
                backgroundColor: [color, '#334155'],
                borderWidth: 0,
            }]
        },
        options: {
            cutout: '72%',
            responsive: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 }, padding: 8 } }
            }
        }
    });
}

// ── Render principal ──────────────────────────────────────────
function renderModulo(user, tickets) {
    const email = user.email.toLowerCase();
    const esAdmin = email === ADMIN_EMAIL;
    const contenedor = document.getElementById('rendimiento-container');
    if (!contenedor) return;

    let lista = [];
    if (esAdmin) {
        lista = Object.entries(TECNICOS).map(([e, t]) => ({ email: e, ...t }));
    } else {
        const tec = TECNICOS[email];
        if (tec) lista = [{ email, ...tec }];
    }

    const grid = esAdmin ? 'corp-grid-admin' : 'corp-grid-solo';
    contenedor.innerHTML = `<div class="corp-grid ${grid}">${lista.map(t => renderTarjeta(t, tickets.filter(tk => tk.tecnico === t.alias))).join('')}</div>`;

    lista.forEach(tec => {
        const misTks = tickets.filter(tk => tk.tecnico === tec.alias);
        actualizarTarjeta(tec, misTks);

        document.getElementById(`filtro-${tec.tag}`)?.addEventListener('change', () => {
            actualizarTarjeta(tec, misTks);
        });
    });
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (!user) return;
        const q = query(collection(db, 'tickets'), orderBy('creadoEn', 'desc'));
        onSnapshot(q, snap => {
            const todos = snap.docs.map(d => d.data());
            renderModulo(user, todos);
        });
    });
});