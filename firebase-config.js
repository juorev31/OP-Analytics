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
            <div class="bienvenida-logo">
                <img src="Imagenes/logoinicioprimax.png" alt="PRIMAX">
            </div>
        </div>`;
    document.body.appendChild(overlay);

    // Animar barra
    // Desvanecer y eliminar
    setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 800);
    }, 2500);
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