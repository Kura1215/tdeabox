import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Alerta from '../components/Alerta';

export default function Login() {
    const [mostrarRegistro, setMostrarRegistro] = useState(false);
    const [alerta, setAlerta] = useState({ mensaje: '', tipo: '' });
    const { login } = useAuth();
    const navigate = useNavigate();

    const [loginCorreo, setLoginCorreo] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    const [regNombre, setRegNombre] = useState('');
    const [regUsername, setRegUsername] = useState('');
    const [regCorreo, setRegCorreo] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regConfirmPassword, setRegConfirmPassword] = useState('');
    const [regFoto, setRegFoto] = useState(null);

    function cambiarARegistro(e) {
        e.preventDefault();
        setAlerta({ mensaje: '', tipo: '' });
        setMostrarRegistro(true);
    }

    function cambiarALogin(e) {
        e.preventDefault();
        setAlerta({ mensaje: '', tipo: '' });
        setMostrarRegistro(false);
    }

    async function handleLogin(e) {
        e.preventDefault();
        setAlerta({ mensaje: '', tipo: '' });

        if (!loginCorreo || !loginPassword) {
            setAlerta({ mensaje: 'Por favor, completa todos los campos.', tipo: 'error' });
            return;
        }

        try {
            const data = await api.login(loginCorreo, loginPassword);
            setAlerta({ mensaje: '¡Inicio de sesion exitoso! Redirigiendo...', tipo: 'ok' });
            login(data.token, data.usuarioId, data.nombre, data.username, data.fotoPerfil, data.rol);

            setTimeout(() => {
                navigate('/feed');
            }, 800);
        } catch (error) {
            setAlerta({ mensaje: error.message || 'No se pudo iniciar sesion. Credenciales incorrectas.', tipo: 'error' });
        }
    }

    async function handleRegister(e) {
        e.preventDefault();
        setAlerta({ mensaje: '', tipo: '' });

        if (!regNombre || !regUsername || !regCorreo || !regPassword || !regConfirmPassword) {
            setAlerta({ mensaje: 'Por favor, completa todos los campos obligatorios.', tipo: 'error' });
            return;
        }

        if (regPassword.length < 8 || regPassword.length > 20) {
            setAlerta({ mensaje: 'La contraseña debe tener entre 8 y 20 caracteres.', tipo: 'error' });
            return;
        }

        if (!/^[a-zA-Z0-9_]{3,30}$/.test(regUsername)) {
            setAlerta({ mensaje: 'El usuario debe tener 3-30 caracteres: letras, numeros o guion bajo.', tipo: 'error' });
            return;
        }

        if (regPassword !== regConfirmPassword) {
            setAlerta({ mensaje: 'Las contraseñas no coinciden.', tipo: 'error' });
            return;
        }

        if (!/^[^\s@]+@tdea\.edu\.co$/i.test(regCorreo.trim())) {
            setAlerta({ mensaje: 'Solo se permiten correos institucionales @tdea.edu.co.', tipo: 'error' });
            return;
        }

        try {
            const formData = new FormData();
            formData.append('nombre', regNombre);
            formData.append('username', regUsername);
            formData.append('correo', regCorreo);
            formData.append('password', regPassword);
            if (regFoto) formData.append('foto', regFoto);

            // el registro ya devuelve el token: queda con la sesion iniciada
            const data = await api.register(formData);
            setAlerta({ mensaje: '¡Registro exitoso! Redirigiendo...', tipo: 'ok' });
            login(data.token, data.usuarioId, data.nombre, data.username, data.fotoPerfil, data.rol);

            setTimeout(() => {
                navigate('/feed');
            }, 800);
        } catch (error) {
            setAlerta({ mensaje: error.message || 'Error al registrar el usuario.', tipo: 'error' });
        }
    }

    return (
        <>
            <nav>
                <span className="nav-logo">Tdea<span>Vox</span></span>
                <div className="nav-links">
                    <span style={{ color: 'white', fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>Portal de Estudiantes</span>
                </div>
            </nav>

            <div className="container login-container">
                <main className="main-content">
                    <div className="welcome-header">
                        <h1>Tdea<span>Vox</span></h1>
                        <p>La red social y foro exclusivo del Tecnologico de Antioquia</p>
                    </div>

                    <Alerta mensaje={alerta.mensaje} tipo={alerta.tipo} />

                    {!mostrarRegistro && (
                        <div className="box">
                            <div className="box-header">INICIAR SESION</div>
                            <div className="box-body">
                                <form onSubmit={handleLogin}>
                                    <div className="form-group">
                                        <label htmlFor="login-correo">Correo Institucional</label>
                                        <input type="email" id="login-correo" placeholder="usuario@tdea.edu.co"
                                            value={loginCorreo} onChange={(e) => setLoginCorreo(e.target.value)} required />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="login-password">Contraseña</label>
                                        <input type="password" id="login-password" placeholder="••••••••"
                                            value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                                    </div>
                                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                                        Ingresar al Foro
                                    </button>
                                </form>
                                <div className="toggle-link">
                                    ¿No tienes una cuenta? <a href="#" onClick={cambiarARegistro}>Registrate aqui</a>
                                </div>
                            </div>
                        </div>
                    )}

                    {mostrarRegistro && (
                        <div className="box">
                            <div className="box-header">REGISTRAR NUEVA CUENTA</div>
                            <div className="box-body">
                                <form onSubmit={handleRegister}>
                                    <div className="form-group">
                                        <label htmlFor="reg-nombre">Nombre Completo</label>
                                        <input type="text" id="reg-nombre" placeholder="Juan Perez" maxLength={100}
                                            value={regNombre} onChange={(e) => setRegNombre(e.target.value)} required />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="reg-username">Nombre de Usuario (Apodo)</label>
                                        <input type="text" id="reg-username" placeholder="juan_tdea" maxLength={30}
                                            value={regUsername} onChange={(e) => setRegUsername(e.target.value)} required />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="reg-correo">Correo Institucional</label>
                                        <input type="email" id="reg-correo" placeholder="usuario@tdea.edu.co"
                                            value={regCorreo} onChange={(e) => setRegCorreo(e.target.value)} required />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="reg-password">Contraseña</label>
                                        <input type="password" id="reg-password" placeholder="Entre 8 y 20 caracteres" minLength={8} maxLength={20}
                                            value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="reg-confirm-password">Confirmar Contraseña</label>
                                        <input type="password" id="reg-confirm-password" placeholder="Repite tu contraseña"
                                            value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} required />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="reg-foto">Foto de perfil (opcional, JPG/PNG/WEBP, max. 2 MB)</label>
                                        <input type="file" id="reg-foto" accept="image/jpeg,image/png,image/webp"
                                            onChange={(e) => setRegFoto(e.target.files[0] || null)} />
                                    </div>
                                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                                        Crear Cuenta
                                    </button>
                                </form>
                                <div className="toggle-link">
                                    ¿Ya tienes cuenta registrada? <a href="#" onClick={cambiarALogin}>Inicia sesion aqui</a>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
