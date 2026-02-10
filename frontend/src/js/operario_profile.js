import { showAlert, showConfirm, clearAuthSession, navigateTo, getAuthHeaders } from './routes.js';

export default async function initProfile() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/';
        return;
    }

    // Actualizar info de usuario en la UI
    const userNameElement = document.getElementById('userName');
    const profileNameElement = document.getElementById('profileName');
    const profileUsernameElement = document.getElementById('profileUsername');

    if (userNameElement) userNameElement.textContent = user.nombres_apellidos || user.username;
    if (profileNameElement) profileNameElement.textContent = user.nombres_apellidos || user.username;
    if (profileUsernameElement) profileUsernameElement.textContent = '@' + user.username;

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

    // Change Password Form
    const form = document.getElementById('changePasswordForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;

            if (newPassword !== confirmNewPassword) {
                await showAlert({
                    title: 'Error',
                    message: 'Las nuevas contraseñas no coinciden.',
                    type: 'error'
                });
                return;
            }

            try {
                const res = await fetch('/api/auth/change-password', {
                    method: 'POST',
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ currentPassword, newPassword })
                });

                const data = await res.json();

                if (res.ok) {
                    await showAlert({
                        title: 'Éxito',
                        message: 'Contraseña actualizada correctamente. Por favor inicia sesión nuevamente.',
                        type: 'success'
                    });
                    // Force logout
                    clearAuthSession();
                    navigateTo('/login');
                } else {
                    await showAlert({
                        title: 'Error',
                        message: data.error || 'No se pudo actualizar la contraseña.',
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