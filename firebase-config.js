// ============================================================
// CONFIGURACIÓN FIREBASE + CONTROL DE SESIÓN (index.html)
// ⚠️ NO modificar las URLs de importación
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBtk3JluulZMZrofKnNA6aNn0usR6of83Y",
    authDomain: "kpi-atenciones.firebaseapp.com",
    projectId: "kpi-atenciones",
    storageBucket: "kpi-atenciones.firebasestorage.app",
    messagingSenderId: "502007721687",
    appId: "1:502007721687:web:c5368c8ea72bb832fdca92"
};

const EMAIL_NOMBRES = {
    'julio.orozco@sonda.com': 'Julio',
    'kevi.inga@sonda.com': 'Kevin',
    'yumich.cordero@sonda.com': 'Yumich'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };

// ── Pantalla de bienvenida ────────────────────────────────────
function mostrarBienvenida(nombre) {
    const overlay = document.createElement('div');
    overlay.id = 'bienvenida-overlay';
    overlay.innerHTML = `
        <div class="bienvenida-card">
            <div class="bienvenida-logo">KPI Atenciones</div>
            <p class="bienvenida-saludo">Bienvenido de vuelta</p>
            <h1 class="bienvenida-nombre">${nombre}</h1>
            <div class="bienvenida-barra">
                <div class="bienvenida-barra-fill"></div>
            </div>
            <p class="bienvenida-sub">Cargando tu panel...</p>
        </div>`;
    document.body.appendChild(overlay);

    // Animar barra
    setTimeout(() => {
        const fill = overlay.querySelector('.bienvenida-barra-fill');
        if (fill) fill.style.width = '100%';
    }, 100);

    // Desvanecer y eliminar
    setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 600);
    }, 4800);
}

// ── Verificar sesión ──────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        const emailEl = document.getElementById('user-email');
        if (emailEl) emailEl.textContent = user.email;

        const nombre = EMAIL_NOMBRES[user.email.toLowerCase()] || user.email.split('@')[0];
        mostrarBienvenida(nombre);
    }
});

// ── Cerrar sesión ─────────────────────────────────────────────
document.getElementById('btn-logout').addEventListener('click', async (e) => {
    e.preventDefault();
    await signOut(auth);
    window.location.href = 'login.html';
});