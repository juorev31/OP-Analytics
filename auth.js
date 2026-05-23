// auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBtk3JluulZMZrofKnNA6aNn0usR6of83Y",
    authDomain: "kpi-atenciones.firebaseapp.com",
    projectId: "kpi-atenciones",
    storageBucket: "kpi-atenciones.firebasestorage.app",
    messagingSenderId: "502007721687",
    appId: "1:502007721687:web:c5368c8ea72bb832fdca92",
    measurementId: "G-38KQNTRH1M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const botonSubmit = document.querySelector('.btn-login');

    botonSubmit.innerText = "Verificando...";
    botonSubmit.disabled = true;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Error de autenticación:", error.code);
        alert("Credenciales incorrectas. Por favor, verifica tu correo y contraseña.");
        botonSubmit.innerText = "Ingresar";
        botonSubmit.disabled = false;
    }
});