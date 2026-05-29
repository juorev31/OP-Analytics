// ============================================================
// almacenamiento.js — Gestión de Discos y Backups de Usuarios
// ============================================================

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore, collection, addDoc, updateDoc, deleteDoc,
    doc, query, orderBy, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

// ── Estado local ──────────────────────────────────────────────
let discosCache = [];
let usuariosCache = [];
let discoSeleccionado = null;

// ── Inicialización ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (!user) return;
        escucharDiscos();
        escucharUsuariosBackup();
        bindEventos();
    });
});

function bindEventos() {
    document.getElementById('btn-nuevo-disco')
        ?.addEventListener('click', () => abrirModalDisco());
    document.getElementById('btn-guardar-disco')
        ?.addEventListener('click', guardarDisco);
    document.getElementById('btn-cancelar-disco')
        ?.addEventListener('click', cerrarModalDisco);
    document.getElementById('btn-guardar-backup-usuario')
        ?.addEventListener('click', guardarUsuarioBackup);
    document.getElementById('btn-cancelar-backup-usuario')
        ?.addEventListener('click', cerrarModalUsuario);

    // Buscador de usuarios
    document.getElementById('buscador-usuario')
        ?.addEventListener('input', (e) => buscarUsuario(e.target.value.trim()));
}

// ── Buscador de usuarios en discos ────────────────────────────
function buscarUsuario(termino) {
    const resultadoEl = document.getElementById('resultado-busqueda');
    if (!resultadoEl) return;

    if (!termino) {
        resultadoEl.style.display = 'none';
        resultadoEl.innerHTML = '';
        document.querySelectorAll('.disco-card').forEach(c => c.classList.remove('disco-card--match', 'disco-card--dimmed'));
        return;
    }

    const terminoLower = termino.toLowerCase();
    const coincidencias = usuariosCache.filter(u => u.nombre.toLowerCase().includes(terminoLower));

    const porDisco = {};
    coincidencias.forEach(u => {
        if (!porDisco[u.discoId]) porDisco[u.discoId] = [];
        porDisco[u.discoId].push(u);
    });

    const discosConMatch = Object.keys(porDisco);

    document.querySelectorAll('.disco-card').forEach(card => {
        const discoId = card.dataset.discoId;
        if (discosConMatch.includes(discoId)) {
            card.classList.add('disco-card--match');
            card.classList.remove('disco-card--dimmed');
        } else {
            card.classList.add('disco-card--dimmed');
            card.classList.remove('disco-card--match');
        }
    });

    resultadoEl.style.display = 'block';

    if (coincidencias.length === 0) {
        resultadoEl.innerHTML = `
            <p style="color:#64748b; font-size:14px;">
                No se encontró ningún usuario con "<strong style="color:#e2e8f0;">${termino}</strong>".
            </p>`;
        return;
    }

    const filas = discosConMatch.map(discoId => {
        const disco = discosCache.find(d => d.id === discoId);
        if (!disco) return '';
        const usuarios = porDisco[discoId];
        const estadoColor = disco.operativo === true ? '#22c55e' : '#ef4444';
        const estadoTexto = disco.operativo === true ? 'Operativo' : 'No operativo';

        return `
            <div style="margin-bottom:12px; padding:12px 14px; background:#0f172a;
                border-radius:8px; border-left:3px solid #2563eb;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="color:#e2e8f0; font-weight:700; font-size:14px;">
                        💾 ${disco.nombre || 'Disco ' + disco.idDisco}
                        <span style="color:#64748b; font-weight:400; font-size:12px; margin-left:6px;">
                            ID: ${disco.idDisco} · Serie: ${disco.numSerie}
                        </span>
                    </span>
                    <span style="font-size:11px; font-weight:600; color:${estadoColor};
                        background:${estadoColor}18; padding:3px 8px; border-radius:20px;">
                        ${estadoTexto}
                    </span>
                </div>
                ${usuarios.map(u => `
                    <div style="display:flex; justify-content:space-between; align-items:center;
                        padding:5px 0; border-top:1px solid #1e293b;">
                        <span style="color:#94a3b8; font-size:13px;">👤 ${u.nombre}</span>
                        <span style="color:#64748b; font-size:12px;">${parseFloat(u.pesoGB).toFixed(1)} GB</span>
                    </div>`).join('')}
            </div>`;
    }).join('');

    resultadoEl.innerHTML = `
        <p style="color:#64748b; font-size:12px; margin-bottom:10px;">
            ${coincidencias.length} usuario(s) encontrado(s) en ${discosConMatch.length} disco(s):
        </p>
        ${filas}`;
}

// ── Escuchar discos en tiempo real ────────────────────────────
function escucharDiscos() {
    const q = query(collection(db, 'discos'), orderBy('creadoEn', 'desc'));
    onSnapshot(q, (snap) => {
        discosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarDiscos();
    });
}

// ── Escuchar usuarios backup en tiempo real ───────────────────
function escucharUsuariosBackup() {
    const q = query(collection(db, 'backup_usuarios'), orderBy('creadoEn', 'desc'));
    onSnapshot(q, (snap) => {
        usuariosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderizarDiscos();
    });
}

// ── Renderizar tarjetas de discos ─────────────────────────────
function renderizarDiscos() {
    const contenedor = document.getElementById('lista-discos');
    if (!contenedor) return;

    if (discosCache.length === 0) {
        contenedor.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:48px; color:#64748b;">
                <p style="font-size:15px;">No hay discos registrados aún.</p>
                <p style="font-size:13px; margin-top:6px;">Haz clic en "Nuevo Disco" para comenzar.</p>
            </div>`;
        return;
    }

    contenedor.innerHTML = discosCache.map(disco => {
        const usuariosDelDisco = usuariosCache.filter(u => u.discoId === disco.id);
        const usadoGB = usuariosDelDisco.reduce((acc, u) => acc + (parseFloat(u.pesoGB) || 0), 0);
        const totalGB = parseFloat(disco.capacidadGB) || 1;
        const libresGB = Math.max(0, totalGB - usadoGB);
        const pct = Math.min(100, Math.round((usadoGB / totalGB) * 100));
        const colorBarra = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e';
        const estadoColor = disco.operativo ? '#22c55e' : '#ef4444';
        const estadoTexto = disco.operativo ? 'Operativo' : 'No operativo';

        return `
        <div class="disco-card" data-disco-id="${disco.id}">
            <div class="disco-card-header">
                <div>
                    <span class="disco-id-badge">ID: ${disco.idDisco}</span>
                    <h3 class="disco-nombre">${disco.nombre || 'Disco ' + disco.idDisco}</h3>
                </div>
                <span style="font-size:12px; font-weight:600; color:${estadoColor};
                    background:${estadoColor}18; padding:4px 10px; border-radius:20px;">
                    ${estadoTexto}
                </span>
            </div>

            <div class="disco-meta">
                <span>N° Serie: <strong>${disco.numSerie}</strong></span>
                <span>Capacidad: <strong>${totalGB} GB</strong></span>
                <span>Usuarios: <strong>${usuariosDelDisco.length}</strong></span>
            </div>

            <div style="margin:14px 0 6px;">
                <div style="display:flex; justify-content:space-between; font-size:12px; color:#94a3b8; margin-bottom:6px;">
                    <span>Usado: ${usadoGB.toFixed(1)} GB</span>
                    <span>Libre: ${libresGB.toFixed(1)} GB · ${pct}%</span>
                </div>
                <div style="background:#1e293b; border-radius:6px; height:8px; overflow:hidden;">
                    <div style="width:${pct}%; height:100%; background:${colorBarra};
                        border-radius:6px; transition:width .4s ease;"></div>
                </div>
            </div>

            <div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
                <button class="btn-accion btn-ver-usuarios" data-id="${disco.id}"
                    style="flex:1; min-width:120px;">
                    <i data-lucide="users" style="width:14px;height:14px;"></i> Ver usuarios (${usuariosDelDisco.length})
                </button>
                <button class="btn-accion btn-editar-disco" data-id="${disco.id}"
                    style="background:#1e293b; border:1px solid #334155;">
                    <i data-lucide="pencil" style="width:14px;height:14px;"></i>
                </button>
                <button class="btn-accion btn-eliminar-disco" data-id="${disco.id}"
                    style="background:#1e293b; border:1px solid #334155; color:#ef4444;">
                    <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                </button>
            </div>
        </div>`;
    }).join('');

    document.querySelectorAll('.btn-ver-usuarios').forEach(btn => {
        btn.addEventListener('click', () => abrirModalUsuarios(btn.dataset.id));
    });
    document.querySelectorAll('.btn-editar-disco').forEach(btn => {
        btn.addEventListener('click', () => editarDisco(btn.dataset.id));
    });
    document.querySelectorAll('.btn-eliminar-disco').forEach(btn => {
        btn.addEventListener('click', () => eliminarDisco(btn.dataset.id));
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Helper: obtener primer ID libre (reutiliza huecos) ────────
function getSiguienteIdLibre() {
    const idsUsados = new Set(
        discosCache.map(d => parseInt(d.idDisco, 10)).filter(n => !isNaN(n))
    );
    let candidato = 1;
    while (idsUsados.has(candidato)) candidato++;
    return String(candidato).padStart(2, '0'); // → "01", "02", etc.
}

// ── Modal: Nuevo / Editar disco ───────────────────────────────
function abrirModalDisco(discoId = null) {
    const modal = document.getElementById('modal-disco');
    const titulo = document.getElementById('modal-disco-titulo');
    if (!modal) return;

    const campoId = document.getElementById('disco-idDisco');

    document.getElementById('disco-edit-id').value = discoId || '';
    document.getElementById('disco-nombre').value = '';
    document.getElementById('disco-numSerie').value = '';
    document.getElementById('disco-capacidad').value = '';
    document.getElementById('disco-operativo').value = 'true';

    // El campo ID siempre es de solo lectura — lo asigna el sistema
    campoId.disabled = true;
    campoId.style.opacity = '0.45';
    campoId.style.cursor = 'not-allowed';
    campoId.style.userSelect = 'none';

    if (discoId) {
        const disco = discosCache.find(d => d.id === discoId);
        if (disco) {
            titulo.textContent = 'Editar Disco';
            campoId.value = disco.idDisco;
            document.getElementById('disco-nombre').value = disco.nombre || '';
            document.getElementById('disco-numSerie').value = disco.numSerie;
            document.getElementById('disco-capacidad').value = disco.capacidadGB;
            document.getElementById('disco-operativo').value = disco.operativo ? 'true' : 'false';
        }
    } else {
        titulo.textContent = 'Nuevo Disco';
        campoId.value = getSiguienteIdLibre();
    }

    modal.classList.remove('hidden');
}

function cerrarModalDisco() {
    document.getElementById('modal-disco')?.classList.add('hidden');
}

async function guardarDisco() {
    const editId = document.getElementById('disco-edit-id').value;
    const idDiscoRaw = document.getElementById('disco-idDisco').value; // campo deshabilitado, valor asignado por sistema
    const idDisco = idDiscoRaw; // ya viene normalizado desde getSiguienteIdLibre() o del disco existente
    const nombre = document.getElementById('disco-nombre').value.trim();
    const numSerie = document.getElementById('disco-numSerie').value.trim();
    const capacidadGB = parseFloat(document.getElementById('disco-capacidad').value);
    const operativo = document.getElementById('disco-operativo').value === 'true';
    const msgEl = document.getElementById('msg-disco');

    if (!idDisco || !numSerie || isNaN(capacidadGB) || capacidadGB <= 0) {
        mostrarMsg(msgEl, '⚠️ Completa todos los campos correctamente.', 'error'); return;
    }

    const duplicadoId = discosCache.some(d => parseInt(d.idDisco, 10) === parseInt(idDisco, 10) && d.id !== editId);
    const duplicadoSerie = discosCache.some(d => d.numSerie === numSerie && d.id !== editId);

    if (duplicadoId) {
        mostrarMsg(msgEl, '⚠️ Ya existe un disco con ese ID.', 'error'); return;
    }
    if (duplicadoSerie) {
        mostrarMsg(msgEl, '⚠️ Ya existe un disco con ese número de serie.', 'error'); return;
    }

    try {
        if (editId) {
            await updateDoc(doc(db, 'discos', editId), { idDisco, nombre, numSerie, capacidadGB, operativo });
        } else {
            await addDoc(collection(db, 'discos'), {
                idDisco, nombre, numSerie, capacidadGB, operativo,
                creadoEn: Timestamp.now()
            });
        }
        mostrarMsg(msgEl, '✅ Disco guardado.', 'ok');
        setTimeout(cerrarModalDisco, 800);
    } catch (err) {
        mostrarMsg(msgEl, '❌ Error: ' + err.message, 'error');
    }
}

function editarDisco(id) { abrirModalDisco(id); }

async function eliminarDisco(id) {
    const usuariosEnDisco = usuariosCache.filter(u => u.discoId === id);
    if (usuariosEnDisco.length > 0) {
        alert(`⚠️ Este disco tiene ${usuariosEnDisco.length} usuario(s) registrado(s). Elimínalos primero.`);
        return;
    }
    if (!confirm('¿Seguro que quieres eliminar este disco?')) return;
    try {
        await deleteDoc(doc(db, 'discos', id));
    } catch (err) {
        alert('Error al eliminar: ' + err.message);
    }
}

// ── Modal: Usuarios del disco ─────────────────────────────────
function abrirModalUsuarios(discoId) {
    discoSeleccionado = discoId;
    const disco = discosCache.find(d => d.id === discoId);
    const modal = document.getElementById('modal-usuarios-disco');
    if (!modal || !disco) return;

    document.getElementById('modal-usuarios-titulo').textContent =
        `Usuarios en disco ${disco.idDisco}`;
    document.getElementById('bu-nombre').value = '';
    document.getElementById('bu-peso').value = '';
    document.getElementById('bu-edit-id').value = '';
    document.getElementById('msg-backup-usuario').textContent = '';

    renderizarUsuariosModal(discoId);
    modal.classList.remove('hidden');
}

function cerrarModalUsuario() {
    document.getElementById('modal-usuarios-disco')?.classList.add('hidden');
    discoSeleccionado = null;
}

function renderizarUsuariosModal(discoId) {
    const lista = document.getElementById('lista-usuarios-disco');
    if (!lista) return;
    const usuarios = usuariosCache.filter(u => u.discoId === discoId);

    if (usuarios.length === 0) {
        lista.innerHTML = '<p style="color:#64748b; font-size:13px; padding:8px 0;">Sin usuarios registrados en este disco.</p>';
        return;
    }

    lista.innerHTML = `
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
                <tr style="color:#64748b; border-bottom:1px solid #1e293b;">
                    <th style="text-align:left; padding:8px 6px;">Usuario</th>
                    <th style="text-align:right; padding:8px 6px;">Peso (GB)</th>
                    <th style="padding:8px 6px;"></th>
                </tr>
            </thead>
            <tbody>
                ${usuarios.map(u => `
                <tr style="border-bottom:1px solid #1e293b20;">
                    <td style="padding:8px 6px; color:#e2e8f0;">${u.nombre}</td>
                    <td style="padding:8px 6px; text-align:right; color:#94a3b8;">${parseFloat(u.pesoGB).toFixed(1)} GB</td>
                    <td style="padding:8px 6px; text-align:right; display:flex; gap:6px; justify-content:flex-end;">
                        <button class="btn-accion btn-editar-bu" data-id="${u.id}"
                            style="padding:4px 10px; font-size:12px; background:#1e293b; border:1px solid #334155;">
                            ✏️
                        </button>
                        <button class="btn-accion btn-eliminar-bu" data-id="${u.id}"
                            style="padding:4px 10px; font-size:12px; background:#1e293b; border:1px solid #334155; color:#ef4444;">
                            🗑️
                        </button>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>`;

    lista.querySelectorAll('.btn-editar-bu').forEach(btn => {
        btn.addEventListener('click', () => {
            const u = usuariosCache.find(x => x.id === btn.dataset.id);
            if (!u) return;
            document.getElementById('bu-edit-id').value = u.id;
            document.getElementById('bu-nombre').value = u.nombre;
            document.getElementById('bu-peso').value = u.pesoGB;
        });
    });

    lista.querySelectorAll('.btn-eliminar-bu').forEach(btn => {
        btn.addEventListener('click', () => eliminarUsuarioBackup(btn.dataset.id));
    });
}

async function guardarUsuarioBackup() {
    const editId = document.getElementById('bu-edit-id').value;
    const nombre = document.getElementById('bu-nombre').value.trim();
    const pesoGB = parseFloat(document.getElementById('bu-peso').value);
    const msgEl = document.getElementById('msg-backup-usuario');

    if (!nombre || isNaN(pesoGB) || pesoGB <= 0) {
        mostrarMsg(msgEl, '⚠️ Completa los campos correctamente.', 'error'); return;
    }

    const disco = discosCache.find(d => d.id === discoSeleccionado);
    if (!disco) {
        mostrarMsg(msgEl, '⚠️ No hay disco seleccionado.', 'error'); return;
    }

    const usadoActual = usuariosCache
        .filter(u => u.discoId === discoSeleccionado && u.id !== editId)
        .reduce((acc, u) => acc + (parseFloat(u.pesoGB) || 0), 0);

    if (usadoActual + pesoGB > parseFloat(disco.capacidadGB)) {
        mostrarMsg(msgEl, `⚠️ Sin espacio suficiente. Solo quedan ${(disco.capacidadGB - usadoActual).toFixed(1)} GB libres.`, 'error');
        return;
    }

    try {
        if (editId) {
            await updateDoc(doc(db, 'backup_usuarios', editId), { nombre, pesoGB });
        } else {
            await addDoc(collection(db, 'backup_usuarios'), {
                nombre, pesoGB, discoId: discoSeleccionado, creadoEn: Timestamp.now()
            });
        }
        document.getElementById('bu-nombre').value = '';
        document.getElementById('bu-peso').value = '';
        document.getElementById('bu-edit-id').value = '';
        mostrarMsg(msgEl, '✅ Guardado.', 'ok');
        renderizarUsuariosModal(discoSeleccionado);
    } catch (err) {
        mostrarMsg(msgEl, '❌ Error: ' + err.message, 'error');
    }
}

async function eliminarUsuarioBackup(id) {
    if (!confirm('¿Eliminar este usuario del disco?')) return;
    try {
        await deleteDoc(doc(db, 'backup_usuarios', id));
        renderizarUsuariosModal(discoSeleccionado);
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ── Helper ────────────────────────────────────────────────────
function mostrarMsg(el, texto, tipo) {
    if (!el) return;
    el.textContent = texto;
    el.style.color = tipo === 'ok' ? '#22c55e' : '#ef4444';
    setTimeout(() => { if (el) el.textContent = ''; }, 3000);
}