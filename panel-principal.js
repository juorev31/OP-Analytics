// ============================================================
// panel-principal.js — Panel Principal desde Firestore
// ============================================================

import { db } from './firebase-config.js';
import { ALIASES_VALIDOS } from './tecnicos.js';
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const TECNICOS_VALIDOS = ALIASES_VALIDOS;

// Zona horaria Perú
function getMesActual() {
    const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    return {
        mm: String(ahora.getMonth() + 1).padStart(2, '0'),
        yyyy: String(ahora.getFullYear()),
        mes: ahora.toLocaleString('es-PE', { month: 'long', timeZone: 'America/Lima' })
    };
}

function esMesActual(fecha) {
    if (!fecha) return false;
    const { mm, yyyy } = getMesActual();
    return fecha.endsWith(`/${mm}/${yyyy}`);
}

function diffMinutos(hi, hf) {
    if (!hi || !hf || !hi.includes(':') || !hf.includes(':')) return null;
    const [hIn, mIn] = hi.split(':').map(Number);
    const [hFi, mFi] = hf.split(':').map(Number);
    const diff = (hFi * 60 + mFi) - (hIn * 60 + mIn);
    return diff > 0 ? diff : null;
}

// ── Escuchar Firestore en tiempo real ─────────────────────────
function iniciarPanelPrincipal() {
    const q = query(collection(db, 'tickets'), orderBy('creadoEn', 'desc'));

    onSnapshot(q, (snap) => {
        // Filtrar solo mes actual
        const tickets = [];
        snap.forEach(doc => {
            const d = doc.data();
            if (esMesActual(d.fecha)) tickets.push(d);
        });

        actualizarCards(tickets);
        actualizarGraficos(tickets);
    });
}

// ── Cards KPI ─────────────────────────────────────────────────
function actualizarCards(tickets) {
    const { mes, yyyy } = getMesActual();

    // Tickets totales
    const total = tickets.length;
    const elTotal = document.getElementById('kpi-total-atenciones');
    const elSub = document.getElementById('kpi-sub-total');
    if (elTotal) elTotal.textContent = total;
    if (elSub) elSub.textContent = mes.charAt(0).toUpperCase() + mes.slice(1) + ' ' + yyyy;

    // Tickets de Analistas
    const conteo = { VIP: 0, INC: 0, REQ: 0 };
    const mapaAlias = { 'JULIO A.VIP': 'VIP', 'KEVIN A.INC': 'INC', 'YUMICH A.REQ': 'REQ' };
    tickets.forEach(t => {
        const alias = mapaAlias[t.tecnico];
        if (alias) conteo[alias]++;
    });
    const elAnalistas = document.getElementById('kpi-tiempo-espera');
    if (elAnalistas) elAnalistas.textContent = `VIP: ${conteo.VIP} | INC: ${conteo.INC} | REQ: ${conteo.REQ}`;

    // Cumplimiento SLA (<2h)
    const conTiempo = tickets.filter(t => diffMinutos(t.horaInicio, t.horaFin) !== null);
    const slaOk = conTiempo.filter(t => diffMinutos(t.horaInicio, t.horaFin) < 120).length;
    const sla = conTiempo.length > 0 ? Math.round((slaOk / conTiempo.length) * 100) : 0;
    const elSla = document.getElementById('kpi-tasa-solucion');
    if (elSla) elSla.textContent = sla + '%';
}

// ── Gráficos y tabla ──────────────────────────────────────────
function actualizarGraficos(tickets) {
    if (typeof renderizarPanelPrincipalFirestore === 'function') {
        renderizarPanelPrincipalFirestore(tickets);
    }
}

// ── Iniciar al cargar DOM ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    iniciarPanelPrincipal();
});