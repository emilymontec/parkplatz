export function initLogin() {
    const form = document.getElementById('loginForm');
    const errorText = document.getElementById('error');
    
    if (!form || !errorText) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorText.textContent = '';
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const submitButton = form.querySelector('button');
        const originalButtonContent = submitButton.innerHTML;

        // Loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<span>Verificando...</span>';

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al iniciar sesión');
            }

            // Success state
            submitButton.innerHTML = '<span>¡Bienvenido!</span>';
            submitButton.style.backgroundColor = '#10B981'; // Green
            
            // Guardar sesión
            localStorage.setItem('user', JSON.stringify(data.user));

            // Simular redirección
            setTimeout(() => {
                // Por ahora solo mostramos un mensaje, ya que no hay dashboard implementado en este SPA
                // En un futuro, aquí se llamaría a loadRoute('/dashboard') o similar
                alert(`Bienvenido ${data.user.nombres_apellidos}`);
            }, 800);

        } catch (err) {
            console.error(err);
            errorText.textContent = err.message || 'Error de conexión';
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonContent;
        }
    });
}
