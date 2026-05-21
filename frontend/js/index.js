// Referencias a los elementos del DOM
const loginBox = document.getElementById('login-box');
const registerBox = document.getElementById('register-box');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const linkShowRegister = document.getElementById('link-show-register');
const linkShowLogin = document.getElementById('link-show-login');
const alertMessage = document.getElementById('alert-message');

// Función para mostrar alertas retro (error o éxito)
function mostrarAlerta(mensaje, esExito = false) {
    alertMessage.textContent = mensaje;
    alertMessage.style.display = 'block';
    
    if (esExito) {
        alertMessage.className = 'alerta alerta-ok';
    } else {
        alertMessage.className = 'alerta alerta-error';
    }
}

// Función para ocultar la alerta
function ocultarAlerta() {
    alertMessage.style.display = 'none';
    alertMessage.textContent = '';
}

// Alternar pantallas: Mostrar Registro
linkShowRegister.addEventListener('click', (e) => {
    e.preventDefault();
    ocultarAlerta();
    loginBox.style.display = 'none';
    registerBox.style.display = 'block';
    registerForm.reset();
});

// Alternar pantallas: Mostrar Login
linkShowLogin.addEventListener('click', (e) => {
    e.preventDefault();
    ocultarAlerta();
    registerBox.style.display = 'none';
    loginBox.style.display = 'block';
    loginForm.reset();
});

// Manejar el envío del formulario de Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarAlerta();

    const correo = document.getElementById('login-correo').value.trim();
    const password = document.getElementById('login-password').value;

    if (!correo || !password) {
        mostrarAlerta('Por favor, completa todos los campos.');
        return;
    }

    try {
        const data = await api.login(correo, password);
        mostrarAlerta('¡Inicio de sesión exitoso! Redirigiendo...', true);
        
        // Guardar sesión en localStorage usando auth.js
        auth.login(data.token, data.usuarioId, data.nombre, data.username, data.fotoPerfil);

        // Pequeño retardo para que el usuario aprecie la alerta de éxito
        setTimeout(() => {
            window.location.href = 'feed.html';
        }, 800);
    } catch (error) {
        mostrarAlerta(error.message || 'No se pudo iniciar sesión. Credenciales incorrectas.');
    }
});

// Manejar el envío del formulario de Registro
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarAlerta();

    const nombre = document.getElementById('reg-nombre').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const correo = document.getElementById('reg-correo').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    // Validar campos vacíos
    if (!nombre || !username || !correo || !password || !confirmPassword) {
        mostrarAlerta('Por favor, completa todos los campos obligatorios.');
        return;
    }

    // Validar contraseña corta
    if (password.length < 6) {
        mostrarAlerta('La contraseña debe tener al menos 6 caracteres.');
        return;
    }

    // Validar coincidencia de contraseña
    if (password !== confirmPassword) {
        mostrarAlerta('Las contraseñas no coinciden.');
        return;
    }

    // Validar correo institucional básico (tdea.edu.co o formato de correo)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo)) {
        mostrarAlerta('Por favor, ingresa un correo electrónico válido.');
        return;
    }

    try {
        const response = await api.register(nombre, username, correo, password);
        mostrarAlerta(response.mensaje || '¡Registro exitoso! Ya puedes iniciar sesión.', true);
        
        // Limpiar registro e ir a login
        registerForm.reset();
        setTimeout(() => {
            registerBox.style.display = 'none';
            loginBox.style.display = 'block';
            ocultarAlerta();
        }, 1500);
    } catch (error) {
        mostrarAlerta(error.message || 'Error al registrar el usuario.');
    }
});
