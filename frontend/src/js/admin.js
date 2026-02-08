import { getAuthHeaders, navigateTo, clearAuthSession } from './routes.js';

export default function initAdmin() {
    console.log('Admin Dashboard Ready');

    // 1. Mostrar info de usuario
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.username) {
        const nameEl = document.getElementById('userName');
        if (nameEl) nameEl.textContent = user.nombres_apellidos || user.username;
        const initEl = document.getElementById('userInitials');
        if (initEl) initEl.textContent = (user.username || 'A').charAt(0).toUpperCase();
    }

    // 2. Configurar botón de logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // 3. Cargar Datos
    loadDashboardData();
    renderActivityTable();
}

async function loadDashboardData() {
    try {
        const res = await fetch('/api/admin/stats', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (res.status === 401) {
            console.warn('Token expirado');
            clearAuthSession();
            navigateTo('/');
            return;
        }

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Error cargando estadísticas');
        }
        
        const stats = await res.json();
        
        const income = document.getElementById('todayIncome');
        const occupancy = document.getElementById('currentOccupancy');
        const active = document.getElementById('activeVehicles');

        if (income) {
            income.textContent = new Intl.NumberFormat('es-CO', { 
                style: 'currency', 
                currency: 'COP', 
                maximumFractionDigits: 0 
            }).format(stats.income);
        }
        if (occupancy) {
            occupancy.textContent = stats.occupancy + '%';
        }
        if (active) {
            active.textContent = stats.active;
        }

    } catch (err) {
        console.error('Error cargando datos:', err);
        alert('Error cargando estadísticas: ' + err.message);
    }
}

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
        navigateTo('/');

    } catch (err) {
        console.error('Logout error:', err);
        // Forzar logout aunque falle
        clearAuthSession();
        navigateTo('/');
    }
}

async function renderActivityTable() {
    const tableBody = document.getElementById('activityTable');
    if (!tableBody) return;

    try {
        const res = await fetch('/api/admin/registros?limit=10', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (res.status === 401) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--danger); padding: 40px;">
                        Sesión expirada. Por favor recarga.
                    </td>
                </tr>
            `;
            return;
        }

        if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

        const responseData = await res.json();
        // Support both { data: [...] } and [...] formats
        const data = Array.isArray(responseData) ? responseData : (responseData.data || []);

        if (!data || data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 40px;">
                        Sin registros
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = data.map(reg => {
            const entryTime = new Date(reg.entrada).toLocaleString('es-CO');
            const isFinished = reg.estado === 'FINALIZADO';
            const badgeClass = isFinished ? 'badge-danger' : 'badge-success';
            // Formato de estado para mostrar
            const statusLabel = isFinished ? 'Finalizado' : 'En Curso';

            return `
                <tr>
                    <td>${entryTime}</td>
                    <td>${reg.placa}</td>
                    <td>
                        <span class="badge ${badgeClass}">
                            ${statusLabel}
                        </span>
                    </td>
                    <td>-</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('Error rendering activity table:', err);
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--danger); padding: 40px;">
                    Error cargando registros
                </td>
            </tr>
        `;
    }
}
