import { navigateTo } from './routes.js';

export default function initChief() {
    console.log('Chief Login Ready');

    const form = document.getElementById('chiefLoginForm');
    const errorDiv = document.getElementById('error');

    if (!form) return;

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const username = form.username.value;
        const password = form.password.value;
        const btn = form.querySelector('button');
        const originalText = btn.innerText;

        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
        btn.disabled = true;
        btn.innerText = 'Verificando...';

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

            // Guardar sesión
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // Redirigir según rol (Debería ser ADMIN)
            if (data.user.rol === 'ADMINISTRADOR') {
                navigateTo('/admin');
            } else {
                navigateTo('/operator');
            }

        } catch (err) {
            errorDiv.textContent = err.message;
            errorDiv.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    };
}
