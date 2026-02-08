import { getAuthHeaders, navigateTo, clearAuthSession } from './routes.js';

export default function initOperator() {
    console.log('Operator Dashboard Ready');

    // 1. Mostrar info de usuario
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.username) {
        const nameEl = document.getElementById('userName');
        const initEl = document.getElementById('userInitials');
        if (nameEl) nameEl.textContent = user.nombres_apellidos || user.username;
        if (initEl) initEl.textContent = (user.username || 'U').charAt(0).toUpperCase();
    }

    // 2. Referencias UI
    const modal = document.getElementById('entryModal');
    const btnEntry = document.getElementById('btnEntry');
    const btnCancel = document.getElementById('btnCancelEntry');
    const form = document.getElementById('entryForm');

    // 3. Configurar logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // 4. Cargar datos reales
    loadVehicles();

    // 5. Lógica de Modal
    if (btnEntry) {
        btnEntry.onclick = () => {
            if (modal) modal.style.display = 'flex';
        };
    }

    if (btnCancel && modal) {
        btnCancel.onclick = () => {
            modal.style.display = 'none';
        }
    }

    // Cerrar al hacer clic fuera del card
    if (modal) {
        modal.onclick = (e) => {
            if (e.target === modal) modal.style.display = 'none';
        }
    }

    // 6. Submit Formulario (ENTRADA)
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.innerText;

            btn.disabled = true;
            btn.innerText = 'Procesando...';

            const placa = form.placa.value.toUpperCase();
            const tipo = form.tipo.value;

            try {
                const res = await fetch('/api/registros/entrada', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ placa, tipo_vehiculo_id: tipo })
                });

                if (res.status === 401) {
                    clearAuthSession();
                    navigateTo('/login');
                    return;
                }

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Error al registrar entrada');

                alert(`Entrada registrada: ${placa}`);
                if (modal) modal.style.display = 'none';
                form.reset();
                loadVehicles();

            } catch (err) {
                alert(err.message);
            } finally {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        };
    }
}

async function loadVehicles() {
    const tbody = document.getElementById('vehiclesBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Cargando...</td></tr>';

    try {
        const res = await fetch('/api/registros/activos', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (res.status === 401) {
            clearAuthSession();
            navigateTo('/login');
            return;
        }

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Error al cargar vehículos');
        }
        
        const vehicles = await res.json();
        renderVehicles(vehicles);
        updateStats(vehicles.length);

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red; padding: 20px;">Error: ${err.message}</td></tr>`;
    }
}

function renderVehicles(vehicles) {
    const tbody = document.getElementById('vehiclesBody');
    if (!tbody) return;

    if (vehicles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #666;">No hay vehículos en el parqueadero</td></tr>';
        return;
    }

    tbody.innerHTML = vehicles.map(v => {
        const horaEntrada = new Date(v.hora_entrada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let tipo = 'Otro';
        if (v.tipo_vehiculo_id == 1) tipo = 'Automóvil';
        else if (v.tipo_vehiculo_id == 2) tipo = 'Camioneta';
        else if (v.tipo_vehiculo_id == 3) tipo = 'Motocicleta';
        
        return `
        <tr>
            <td><strong style="color: #1a1a1a;">${v.placa}</strong></td>
            <td>${tipo}</td>
            <td>${horaEntrada}</td>
            <td><span class="badge badge-success">EN CURSO</span></td>
            <td>
                <button class="btn btn-logout" 
                    style="padding: 5px 10px; font-size: 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;"
                    onclick="window.procesarSalida('${v.placa}')">
                    Salida
                </button>
            </td>
        </tr>
    `}).join('');
}

// Función global para poder llamarla desde el HTML onclick
window.procesarSalida = async (placa) => {
    if (!confirm(`¿Confirmar salida del vehículo ${placa}?`)) return;

    try {
        const res = await fetch('/api/registros/salida', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ placa })
        });

        if (res.status === 401) {
            clearAuthSession();
            navigateTo('/login');
            return;
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al registrar salida');

        const total = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(data.costo_total);
        alert(`Salida exitosa.\n\nTiempo: ${data.duracion_minutos} min\nCosto: ${total}`);
        
        loadVehicles();

    } catch (err) {
        alert(err.message);
    }
};

async function handleLogout() {
    try {
        const res = await fetch('/api/auth/logout', {
            method: 'POST',
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            throw new Error('Error en logout');
        }

        // Limpiar sesión
        clearAuthSession();
        
        // Redirigir a login
        navigateTo('/login');

    } catch (err) {
        console.error('Logout error:', err);
        // Forzar logout aunque falle
        clearAuthSession();
        navigateTo('/login');
    }
}

function updateStats(count) {
    const total = 45; // Capacidad total (30 autos + 15 motos)
    const countEl = document.getElementById('occupancyCount');
    const progressEl = document.getElementById('occupancyProgress');

    if (countEl) countEl.textContent = `${count}/${total}`;
    if (progressEl) {
        const percent = Math.min((count / total) * 100, 100);
        progressEl.style.width = `${percent}%`;
    }
}
