import { showAlert, showConfirm, clearAuthSession, navigateTo, getAuthHeaders } from './routes.js';

export default async function initAdminProfile() {
    // Verificar token antes de cargar
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Elementos UI
    const userNameElement = document.getElementById('userName');
    const profileNameHeader = document.getElementById('profileNameHeader');
    const profileUsernameHeader = document.getElementById('profileUsernameHeader');
    
    const profileNameInput = document.getElementById('profileName');
    const profileEmailInput = document.getElementById('profileEmail');
    
    // Cargar datos del perfil desde API
    try {
        const res = await fetch('/api/auth/profile', {
            headers: getAuthHeaders()
        });
        
        if (res.ok) {
            const user = await res.json();
            
            // Actualizar headers
            if (userNameElement) userNameElement.textContent = user.nombres_apellidos || user.username;
            if (profileNameHeader) profileNameHeader.textContent = user.nombres_apellidos || user.username;
            if (profileUsernameHeader) profileUsernameHeader.textContent = '@' + user.username;
            
            // Actualizar inputs
            if (profileNameInput) profileNameInput.value = user.nombres_apellidos || '';
            if (profileEmailInput) profileEmailInput.value = user.email || '';
            
            // Actualizar localStorage
            const localUser = JSON.parse(localStorage.getItem('user')) || {};
            localStorage.setItem('user', JSON.stringify({ ...localUser, ...user }));
        } else {
            console.error('Error cargando perfil');
            await showAlert({ title: 'Error', message: 'No se pudo cargar la información del perfil.', type: 'error' });
        }
    } catch (err) {
        console.error('Error fetching profile:', err);
    }

    // Logout logic
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const confirmed = await showConfirm({
                title: 'Cerrar Sesión',
                message: '¿Estás seguro que deseas salir del sistema?',
                type: 'warning'
            });
            if (confirmed) {
                try {
                    await fetch('/api/auth/logout', {
                        method: 'POST',
                        headers: getAuthHeaders()
                    });
                } catch (e) {
                    console.error('Logout error', e);
                } finally {
                    clearAuthSession();
                    navigateTo('/login');
                }
            }
        });
    }

    // Update Profile Form
    const form = document.getElementById('updateProfileForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nombres_apellidos = profileNameInput.value;
            const email = profileEmailInput.value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;

            // Validaciones locales
            if (newPassword) {
                if (newPassword.length < 6) {
                    await showAlert({ title: 'Error', message: 'La nueva contraseña debe tener al menos 6 caracteres.', type: 'error' });
                    return;
                }
                if (newPassword !== confirmNewPassword) {
                    await showAlert({ title: 'Error', message: 'Las nuevas contraseñas no coinciden.', type: 'error' });
                    return;
                }
            }

            try {
                const body = { email, nombres_apellidos };
                if (newPassword) {
                    body.password = newPassword;
                }

                const res = await fetch('/api/auth/profile', {
                    method: 'PUT',
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });

                const data = await res.json();

                if (res.ok) {
                    await showAlert({
                        title: 'Éxito',
                        message: 'Perfil actualizado correctamente.' + (newPassword ? ' Por favor inicia sesión nuevamente.' : ''),
                        type: 'success'
                    });
                    
                    if (newPassword) {
                        clearAuthSession();
                        navigateTo('/login');
                    } else {
                        // Recargar datos visuales
                        profileNameHeader.textContent = data.user.nombres_apellidos;
                        userNameElement.textContent = data.user.nombres_apellidos;
                        
                        // Actualizar localStorage
                        const localUser = JSON.parse(localStorage.getItem('user')) || {};
                        localStorage.setItem('user', JSON.stringify({ ...localUser, ...data.user }));
                    }
                } else {
                    await showAlert({
                        title: 'Error',
                        message: data.error || 'No se pudo actualizar el perfil.',
                        type: 'error'
                    });
                }
            } catch (err) {
                console.error(err);
                await showAlert({
                    title: 'Error',
                    message: 'Error de conexión con el servidor.',
                    type: 'error'
                });
            }
        });
    }
}
