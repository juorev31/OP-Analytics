// ============================================================
// calendario.js — Módulo de Calendario de Pagos
// ============================================================
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBtk3JluulZMZrofKnNA6aNn0usR6of83Y",
    authDomain: "kpi-atenciones.firebaseapp.com",
    projectId: "kpi-atenciones",
    storageBucket: "kpi-atenciones.firebasestorage.app",
    messagingSenderId: "502007721687",
    appId: "1:502007721687:web:c5368c8ea72bb832fdca92"
};

const app  = getApps().find(a => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const ADMIN_EMAIL = 'julio.orozco@sonda.com';

const TIPOS_PAGO = {
    'fin_mes'      : { label: 'Pago 1Q y Fin de mes',    color: '#FF6600', text: '#fff' },
    'cts'          : { label: 'Pago 1Q y CTS',           color: '#003087', text: '#fff' },
    'recarga'      : { label: 'Recarga provis',           color: '#10b981', text: '#fff' },
    'gratificacion': { label: 'Pago 1Q y Gratificación', color: '#f59e0b', text: '#fff' },
};

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS  = ['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'];

let pagosData  = {};
let esAdmin    = false;
let mesActual  = new Date().getMonth();
let anioActual = new Date().getFullYear();

async function cargarPagos() {
    try {
        const snap = await getDoc(doc(db, 'calendario_pagos', String(anioActual)));
        pagosData  = snap.exists() ? snap.data() : {};
    } catch { pagosData = {}; }
    renderCalendario();
}

async function guardarDia(clave, tipo) {
    if (tipo) pagosData[clave] = tipo;
    else delete pagosData[clave];
    await setDoc(doc(db, 'calendario_pagos', String(anioActual)), pagosData);
    renderCalendario();
}

function renderCalendario() {
    const contenedor = document.getElementById('calendario-container');
    if (!contenedor) return;

    const hoyReal    = new Date();
    const offset     = (() => { const d = new Date(anioActual, mesActual, 1).getDay(); return d === 0 ? 6 : d - 1; })();
    const diasEnMes  = new Date(anioActual, mesActual + 1, 0).getDate();

    // ── Leyenda ──
    const leyenda = Object.entries(TIPOS_PAGO).map(([, t]) => `
        <div class="cal-leyenda-item">
            <span class="cal-leyenda-dot" style="background:${t.color}"></span>
            <span>${t.label}</span>
        </div>`).join('');

    // ── Celdas ──
    let celdas = Array(offset).fill(`<div class="cal-celda cal-celda--vacia"></div>`).join('');

    for (let dia = 1; dia <= diasEnMes; dia++) {
        const clave   = `${anioActual}-${String(mesActual+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
        const tipo    = pagosData[clave];
        const t       = tipo ? TIPOS_PAGO[tipo] : null;
        const diaSem  = new Date(anioActual, mesActual, dia).getDay();
        const esFinde = diaSem === 0 || diaSem === 6;
        const esHoy   = dia === hoyReal.getDate() && mesActual === hoyReal.getMonth() && anioActual === hoyReal.getFullYear();

        celdas += `
        <div class="cal-celda
            ${esFinde ? 'cal-celda--finde' : ''}
            ${esHoy   ? 'cal-celda--hoy'   : ''}
            ${t       ? 'cal-celda--pago'  : ''}
            ${esAdmin ? 'cal-celda--editable' : ''}"
            ${t ? `style="background:${t.color}"` : ''}
            data-clave="${clave}">
            <span class="cal-num" style="${t ? `color:${t.text}` : ''}">${dia}</span>
            ${t ? `<span class="cal-tag" style="color:${t.text}">${t.label}</span>` : ''}
        </div>`;
    }

    // ── Resumen ──
    const resumen = Object.entries(TIPOS_PAGO).map(([key, t]) => {
        const n = Object.entries(pagosData).filter(([k,v]) => {
            const [a,m] = k.split('-');
            return v === key && +m === mesActual+1 && +a === anioActual;
        }).length;
        return n ? `<div class="cal-res-item">
            <span class="cal-leyenda-dot" style="background:${t.color}"></span>
            <span>${t.label}</span>
            <strong style="color:${t.color}">${n} día${n>1?'s':''}</strong>
        </div>` : '';
    }).join('');

    contenedor.innerHTML = `
    <div class="cal-wrap">

        <div class="cal-nav">
            <button class="cal-btn-nav" id="cal-prev">&#8249;</button>
            <h2 class="cal-titulo">${MESES[mesActual]} ${anioActual}</h2>
            <button class="cal-btn-nav" id="cal-next">&#8250;</button>
        </div>

        <div class="cal-leyenda">${leyenda}</div>

        <div class="cal-grid">
            ${DIAS.map(d => `<div class="cal-dia-cab">${d}</div>`).join('')}
            ${celdas}
        </div>

        ${resumen ? `<div class="cal-resumen">${resumen}</div>` : ''}

        ${esAdmin ? `
        <div id="cal-modal" class="cal-modal hidden">
            <div class="cal-modal-content">
                <p class="cal-modal-fecha" id="cal-modal-fecha"></p>
                <div class="cal-modal-opciones">
                    ${Object.entries(TIPOS_PAGO).map(([key,t]) => `
                    <button class="cal-modal-opcion" data-tipo="${key}" style="border-left:4px solid ${t.color}">
                        <span class="cal-leyenda-dot" style="background:${t.color}"></span>
                        ${t.label}
                    </button>`).join('')}
                    <button class="cal-modal-opcion cal-modal-limpiar" data-tipo="">
                        🗑 Quitar marcado
                    </button>
                </div>
                <button class="cal-modal-cerrar" id="cal-modal-cerrar">Cancelar</button>
            </div>
        </div>` : ''}

    </div>`;

    document.getElementById('cal-prev')?.addEventListener('click', () => {
        if (--mesActual < 0) { mesActual = 11; anioActual--; }
        cargarPagos();
    });
    document.getElementById('cal-next')?.addEventListener('click', () => {
        if (++mesActual > 11) { mesActual = 0; anioActual++; }
        cargarPagos();
    });

    if (esAdmin) {
        document.querySelectorAll('.cal-celda--editable:not(.cal-celda--vacia)').forEach(c => {
            c.addEventListener('click', () => {
                const modal = document.getElementById('cal-modal');
                const [a,m,d] = c.dataset.clave.split('-');
                document.getElementById('cal-modal-fecha').textContent =
                    `${parseInt(d)} de ${MESES[parseInt(m)-1]} ${a}`;
                modal.dataset.clave = c.dataset.clave;
                modal.classList.remove('hidden');
            });
        });
        document.getElementById('cal-modal-cerrar')?.addEventListener('click', () =>
            document.getElementById('cal-modal').classList.add('hidden'));
        document.getElementById('cal-modal')?.addEventListener('click', e => {
            if (e.target.id === 'cal-modal')
                document.getElementById('cal-modal').classList.add('hidden');
        });
        document.querySelectorAll('.cal-modal-opcion').forEach(btn => {
            btn.addEventListener('click', async () => {
                const clave = document.getElementById('cal-modal').dataset.clave;
                document.getElementById('cal-modal').classList.add('hidden');
                await guardarDia(clave, btn.dataset.tipo);
            });
        });
    }
}

// Función global que script.js llama al abrir el panel
window.iniciarCalendario = () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    esAdmin = currentUser.email.toLowerCase() === ADMIN_EMAIL;
    cargarPagos();
};

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (!user) return;
        esAdmin = user.email.toLowerCase() === ADMIN_EMAIL;
        // Solo renderiza si el panel está visible al cargar
        const panel = document.getElementById('panel-calendario');
        if (panel && !panel.classList.contains('hidden')) {
            cargarPagos();
        }
    });
});