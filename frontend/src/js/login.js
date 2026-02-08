export default function initLogin() {
    const form = document.getElementById('loginForm');
    const errorMsg = document.getElementById('error');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.textContent = '';

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const btn = form.querySelector('button');
        const originalText = btn.innerText;

        btn.disabled = true;
        btn.innerText = 'Autenticando...';

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Credenciales inválidas');
            }

            // Éxito: Guardar token y usuario
            const { token, user } = data;
            
            // Guardar token en localStorage (será enviado en headers de futuras peticiones)
            localStorage.setItem('authToken', token);
            localStorage.setItem('user', JSON.stringify(user));

            // Redirigir según el rol
            const userRole = (user.rol || '').toUpperCase();
            
            if (userRole === 'ADMINISTRADOR') {
                location.hash = '/admin';
            } else if (userRole === 'OPERARIO') {
                location.hash = '/operator';
            } else {
                throw new Error('Rol de usuario desconocido: ' + userRole);
            }

        } catch (err) {
            console.error('Login error:', err);
            errorMsg.textContent = err.message || 'Error en la autenticación';
            btn.disabled = false;
            btn.innerText = originalText;
        }
    });
}
