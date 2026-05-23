// ============================================================
// script.js — Navegación + Descarga global de tickets
// ============================================================

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBtk3JluulZMZrofKnNA6aNn0usR6of83Y",
    authDomain: "kpi-atenciones.firebaseapp.com",
    projectId: "kpi-atenciones",
    storageBucket: "kpi-atenciones.firebasestorage.app",
    messagingSenderId: "502007721687",
    appId: "1:502007721687:web:c5368c8ea72bb832fdca92"
};

const _app = getApps().find(a => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);
const _db = getFirestore(_app);

// ── Navegación entre paneles ──────────────────────────────────
const linkPrincipal = document.getElementById('link-principal');
const linkTecnicos = document.getElementById('link-Tecnicos');
const linkTickets = document.getElementById('link-tickets');
const linkReportes = document.getElementById('link-reportes');
const linkAlmacenamiento = document.getElementById('link-almacenamiento');

const panelPrincipal = document.getElementById('panel-principal');
const panelTecnicos = document.getElementById('panel-Tecnicos');
const panelTickets = document.getElementById('panel-tickets');
const panelReportes = document.getElementById('panel-reportes');
const panelAlmacenamiento = document.getElementById('panel-almacenamiento');

function limpiarPaneles() {
    [panelPrincipal, panelTecnicos, panelTickets, panelReportes, panelAlmacenamiento]
        .forEach(p => p?.classList.add('hidden'));
    [linkPrincipal, linkTecnicos, linkTickets, linkReportes, linkAlmacenamiento]
        .forEach(l => l?.classList.remove('active'));
}

linkPrincipal?.addEventListener('click', e => {
    e.preventDefault(); limpiarPaneles();
    panelPrincipal.classList.remove('hidden'); linkPrincipal.classList.add('active');
});
linkTecnicos?.addEventListener('click', e => {
    e.preventDefault(); limpiarPaneles();
    panelTecnicos.classList.remove('hidden'); linkTecnicos.classList.add('active');
});
linkTickets?.addEventListener('click', e => {
    e.preventDefault(); limpiarPaneles();
    panelTickets.classList.remove('hidden'); linkTickets.classList.add('active');
});
linkReportes?.addEventListener('click', e => {
    e.preventDefault(); limpiarPaneles();
    panelReportes.classList.remove('hidden'); linkReportes.classList.add('active');
});
linkAlmacenamiento?.addEventListener('click', e => {
    e.preventDefault(); limpiarPaneles();
    panelAlmacenamiento.classList.remove('hidden'); linkAlmacenamiento.classList.add('active');
});

// ── Menú desplegable de usuario ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const profileMenu = document.getElementById('user-profile-menu');
    const dropdownMenu = document.getElementById('dropdown-menu');
    if (profileMenu && dropdownMenu) {
        profileMenu.addEventListener('click', e => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });
        document.addEventListener('click', () => dropdownMenu.classList.remove('show'));
    }

    document.getElementById('btn-descargar-tickets')
        ?.addEventListener('click', descargarTicketsCSV);
});

// ── Descarga Excel real (.xlsx) ───────────────────────────────
async function descargarTicketsCSV() {

    const btn = document.getElementById('btn-descargar-tickets');
    const msgEl = document.getElementById('msg-descarga');

    btn.disabled = true;
    btn.textContent = 'Generando Excel...';

    if (msgEl) msgEl.textContent = '';

    try {

        const snap = await getDocs(
            query(
                collection(_db, 'tickets'),
                orderBy('creadoEn', 'asc')
            )
        );

        if (snap.empty) {

            if (msgEl) {
                msgEl.textContent = '⚠️ No hay tickets para exportar.';
                msgEl.style.color = '#f59e0b';
            }

            return;
        }

        // Datos para Excel
        const data = snap.docs.map(doc => {

            const d = doc.data();

            return {
                Tecnico: d.tecnico || '',
                Usuario: d.usuario || '',
                Descripcion: d.descripcion || '',
                Fecha: d.fecha || '',
                "Hora Inicio": d.horaInicio || '',
                "Hora Fin": d.horaFin || '',
                Tipo: d.tipo || ''
            };

        });

        // Crear libro Excel
        const wb = XLSX.utils.book_new();

        // Crear hoja Excel
        const ws = XLSX.utils.json_to_sheet(data);

        // Tamaño columnas
        ws['!cols'] = [
            { wch: 20 },
            { wch: 25 },
            { wch: 40 },
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
            { wch: 20 }
        ];

        // Agregar hoja
        XLSX.utils.book_append_sheet(wb, ws, 'Tickets');

        // Fecha
        const fecha = new Date()
            .toLocaleDateString('es-PE')
            .replace(/\//g, '-');

        // Descargar Excel
        XLSX.writeFile(wb, `tickets_${fecha}.xlsx`);

        // Mensaje éxito
        if (msgEl) {

            msgEl.textContent = `✅ ${snap.size} ticket(s) exportados.`;
            msgEl.style.color = '#22c55e';

            setTimeout(() => {
                msgEl.textContent = '';
            }, 3000);
        }

    } catch (err) {

        console.error(err);

        if (msgEl) {
            msgEl.textContent = '❌ Error: ' + err.message;
            msgEl.style.color = '#ef4444';
        }

    } finally {

        btn.disabled = false;
        btn.textContent = '⬇️ Descargar Reporte Excel';

    }
}