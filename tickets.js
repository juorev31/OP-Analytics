// ============================================================
// tickets.js — Registro de Tickets con Firebase Firestore
// ============================================================

import { auth, db } from './firebase-config.js';
import { TECNICOS, EMAIL_A_ALIAS } from './tecnicos.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Selectores de hora ────────────────────────────────────────
function llenarSelectores() {
    ['tk-hi-h','tk-hf-h'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="">HH</option>';
        for (let h = 0; h < 24; h++)
            sel.innerHTML += `<option value="${String(h).padStart(2,'0')}">${String(h).padStart(2,'0')}</option>`;
    });
    ['tk-hi-m','tk-hf-m'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="">MM</option>';
        for (let m = 0; m < 60; m += 5)
            sel.innerHTML += `<option value="${String(m).padStart(2,'0')}">${String(m).padStart(2,'0')}</option>`;
    });
}

// ── Autocomplete fecha (Perú) y técnico ──────────────────────
function inicializarFormulario(user) {
    const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const dd    = String(ahora.getDate()).padStart(2,'0');
    const mm    = String(ahora.getMonth()+1).padStart(2,'0');
    const yyyy  = ahora.getFullYear();
    const fechaEl = document.getElementById('tk-fecha');
    if (fechaEl) fechaEl.value = `${dd}/${mm}/${yyyy}`;

    const tecnicoEl = document.getElementById('tk-tecnico');
    if (tecnicoEl) {
        const email  = user.email.toLowerCase().trim();
        const nombre = EMAIL_A_ALIAS[email] || user.email;
        tecnicoEl.value = nombre;
    }
}

// ── Botones tipo ──────────────────────────────────────────────
function inicializarTipoBtns() {
    document.querySelectorAll('.tipo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('activo'));
            btn.classList.add('activo');
            const tipoEl = document.getElementById('tk-tipo');
            if (tipoEl) tipoEl.value = btn.dataset.tipo;
        });
    });
}

// ── Guardar ticket ────────────────────────────────────────────
async function guardarTicket(user) {
    const tecnico     = document.getElementById('tk-tecnico')?.value.trim();
    const usuario     = document.getElementById('tk-usuario')?.value.trim();
    const descripcion = document.getElementById('tk-descripcion')?.value.trim();
    const tipo        = document.getElementById('tk-tipo')?.value;
    const fecha       = document.getElementById('tk-fecha')?.value;
    const hiH         = document.getElementById('tk-hi-h')?.value;
    const hiM         = document.getElementById('tk-hi-m')?.value;
    const hfH         = document.getElementById('tk-hf-h')?.value;
    const hfM         = document.getElementById('tk-hf-m')?.value;
    const mensaje     = document.getElementById('tk-mensaje');

    if (!usuario || !descripcion || !tipo || !hiH || !hiM || !hfH || !hfM) {
        mostrarMensaje(mensaje, '⚠️ Completa todos los campos', 'error'); return;
    }

    // ✅ CORRECCIÓN: convertir a número antes de comparar
    const hiHn = parseInt(hiH, 10), hiMn = parseInt(hiM, 10);
    const hfHn = parseInt(hfH, 10), hfMn = parseInt(hfM, 10);
    if (hiHn > hfHn || (hiHn === hfHn && hiMn >= hfMn)) {
        mostrarMensaje(mensaje, '⚠️ La hora fin debe ser mayor a la de inicio', 'error'); return;
    }

    try {
        const btn = document.getElementById('btn-guardar-ticket');
        btn.disabled = true; btn.textContent = 'Guardando...';

        await addDoc(collection(db, 'tickets'), {
            tecnico, usuario, descripcion, tipo,
            fecha,
            horaInicio: `${hiH}:${hiM}`,
            horaFin:    `${hfH}:${hfM}`,
            creadoEn:   Timestamp.now(),
            email:      user.email
        });

        mostrarMensaje(mensaje, '✅ Ticket guardado', 'ok');
        limpiarFormulario();
        inicializarFormulario(user);
    } catch (err) {
        console.error(err);
        mostrarMensaje(mensaje, '❌ Error al guardar: ' + err.message, 'error');
    } finally {
        const btn = document.getElementById('btn-guardar-ticket');
        if (btn) { btn.disabled = false; btn.textContent = 'Guardar Ticket'; }
    }
}

// ── Historial en tiempo real ──────────────────────────────────
const TICKETS_POR_PAGINA = 7;
let paginaActual = 1;
let ticketsCache = [];

function renderizarHistorial() {
    const contenedor = document.getElementById('tabla-tickets-historial');
    if (!contenedor) return;

    if (ticketsCache.length === 0) {
        contenedor.innerHTML = '<p class="historial-vacio">No hay tickets registrados este mes.</p>';
        return;
    }

    const totalPaginas = Math.ceil(ticketsCache.length / TICKETS_POR_PAGINA);
    paginaActual = Math.min(paginaActual, totalPaginas);

    const inicio = (paginaActual - 1) * TICKETS_POR_PAGINA;
    const fin    = inicio + TICKETS_POR_PAGINA;
    const ticketsPagina = ticketsCache.slice(inicio, fin);

    const filas = ticketsPagina.map(t => `
        <tr class="tabla-fila">
            <td class="tabla-cel">${t.fecha}</td>
            <td class="tabla-cel">${t.tecnico}</td>
            <td class="tabla-cel">${t.usuario}</td>
            <td class="tabla-cel tabla-cel--desc">${t.descripcion}</td>
            <td class="tabla-cel"><span class="tipo-tag tipo-${t.tipo.toLowerCase()}">${t.tipo}</span></td>
            <td class="tabla-cel">${t.horaInicio}</td>
            <td class="tabla-cel">${t.horaFin}</td>
        </tr>`).join('');

    contenedor.innerHTML = `
        <table class="tabla-productividad">
            <thead><tr>
                <th class="tabla-th">Fecha</th>
                <th class="tabla-th">Técnico</th>
                <th class="tabla-th">Usuario</th>
                <th class="tabla-th">Descripción</th>
                <th class="tabla-th">Tipo</th>
                <th class="tabla-th">H. Inicio</th>
                <th class="tabla-th">H. Fin</th>
            </tr></thead>
            <tbody>${filas}</tbody>
        </table>
        <div class="paginacion">
            <span class="paginacion__info">
                Mostrando ${inicio + 1}–${Math.min(fin, ticketsCache.length)} de ${ticketsCache.length} tickets
            </span>
            <div class="paginacion__controles">
                <button id="btn-pag-anterior" class="paginacion__btn ${paginaActual === 1 ? 'paginacion__btn--disabled' : 'paginacion__btn--active'}"
                    ${paginaActual === 1 ? 'disabled' : ''}>
                    ← Anterior
                </button>
                <span class="paginacion__pagina">Página ${paginaActual} de ${totalPaginas}</span>
                <button id="btn-pag-siguiente" class="paginacion__btn ${paginaActual === totalPaginas ? 'paginacion__btn--disabled' : 'paginacion__btn--active'}"
                    ${paginaActual === totalPaginas ? 'disabled' : ''}>
                    Siguiente →
                </button>
            </div>
        </div>`;

    document.getElementById('btn-pag-anterior')?.addEventListener('click', () => {
        if (paginaActual > 1) { paginaActual--; renderizarHistorial(); }
    });
    document.getElementById('btn-pag-siguiente')?.addEventListener('click', () => {
        if (paginaActual < totalPaginas) { paginaActual++; renderizarHistorial(); }
    });
}

function escucharHistorial() {
    const ahora  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const mm     = String(ahora.getMonth()+1).padStart(2,'0');
    const yyyy   = ahora.getFullYear();
    const sufijo = `/${mm}/${yyyy}`;

    const q = query(collection(db, 'tickets'), orderBy('creadoEn', 'desc'));
    onSnapshot(q, (snap) => {
        ticketsCache = [];
        snap.forEach(doc => {
            const d = doc.data();
            if (d.fecha && d.fecha.endsWith(sufijo)) ticketsCache.push(d);
        });
        paginaActual = 1;
        renderizarHistorial();
    });
}

// ── Helpers ───────────────────────────────────────────────────
function mostrarMensaje(el, texto, tipo) {
    if (!el) return;
    el.textContent = texto;
    el.style.color = tipo === 'ok' ? '#22c55e' : '#ef4444';
    setTimeout(() => { if (el) el.textContent = ''; }, 3000);
}

function limpiarFormulario() {
    ['tk-usuario','tk-descripcion','tk-tipo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('activo'));
    ['tk-hi-h','tk-hi-m','tk-hf-h','tk-hf-m'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    llenarSelectores();
    inicializarTipoBtns();

    onAuthStateChanged(auth, (user) => {
        if (!user) return;
        inicializarFormulario(user);
        escucharHistorial();
        const btn = document.getElementById('btn-guardar-ticket');
        if (btn) btn.addEventListener('click', () => guardarTicket(user));
    });
});
