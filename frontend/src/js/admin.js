import { getAuthHeaders, navigateTo, clearAuthSession, showAlert } from './routes.js';

export default function initAdmin() {
    console.log('Admin Dashboard Ready');

    // 1. Mostrar info de usuario
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.username) {
        const nameEl = document.getElementById('userName');
        if (nameEl) nameEl.textContent = user.nombres_apellidos || user.username;
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
            navigateTo('/login');
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
            const gananciaTotal = Number(stats.gananciasHoy) || 0;
            // Validar que sea un número positivo válido
            const gananciaValida = (!isNaN(gananciaTotal) && gananciaTotal >= 0) ? gananciaTotal : 0;
            
            income.textContent = new Intl.NumberFormat('es-CO', { 
                style: 'currency', 
                currency: 'COP', 
                maximumFractionDigits: 0 
            }).format(gananciaValida);
        }
        
        if (occupancy) {
            // Capacidad total hardcoded a 45 (según backend)
            const totalCapacity = 45;
            const current = stats.ocupacionActual || 0;
            const percentage = Math.min((current / totalCapacity) * 100, 100).toFixed(0);
            occupancy.textContent = percentage + '%';
        }
        
        if (active) {
            active.textContent = stats.ocupacionActual || 0;
        }

        // Mostrar detalles de ganancias por tarifa si existe
        if (stats.gananciasDetalle && stats.gananciasDetalle.length > 0) {
            const containerEl = document.getElementById('gananciasContainer');
            const detalleEl = document.getElementById('detalleGanancias');
            if (containerEl && detalleEl) {
                containerEl.style.display = 'block';
                const detalleHTML = stats.gananciasDetalle.map(detalle => `
                    <div style="margin: 12px 0; padding: 12px; background: white; border-radius: 6px; border-left: 3px solid var(--primary);">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div>
                                <strong style="font-size: 1rem; color: var(--primary);">${detalle.nombre}</strong><br/>
                                <span style="font-size: 0.85rem; color: var(--text-muted);">
                                    ${detalle.tipo_cobro} • ${detalle.cantidad_registros} registro${detalle.cantidad_registros !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 1.2rem; font-weight: 700; color: var(--success);">
                                    ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(detalle.total_hoy)}
                                </div>
                                <span style="font-size: 0.8rem; color: var(--text-muted);">Tarifa: ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(detalle.valor_tarifa || 0)}</span>
                            </div>
                        </div>
                    </div>
                `).join('');
                detalleEl.innerHTML = detalleHTML;
            }
        } else {
            const containerEl = document.getElementById('gananciasContainer');
            if (containerEl) containerEl.style.display = 'none';
        }

    } catch (err) {
        console.error('Error cargando datos:', err);
        await showAlert({
            title: 'Error de Dashboard',
            message: 'Error cargando estadísticas: ' + err.message,
            type: 'error'
        });
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
        navigateTo('/login');

    } catch (err) {
        console.error('Logout error:', err);
        // Forzar logout aunque falle
        clearAuthSession();
        navigateTo('/login');
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
            
            // Validar y formatear costo total
            const costoNumerico = Number(reg.valor_calculado) || 0;
            const costoValido = (!isNaN(costoNumerico) && costoNumerico >= 0) ? costoNumerico : 0;
            const costoFormato = new Intl.NumberFormat('es-CO', { 
                style: 'currency', 
                currency: 'COP', 
                maximumFractionDigits: 0 
            }).format(costoValido);

            return `
                <tr>
                    <td>${entryTime}</td>
                    <td>${reg.placa}</td>
                    <td>
                        <span class="badge ${badgeClass}">
                            ${statusLabel}
                        </span>
                    </td>
                    <td style="font-weight: 600; color: var(--success);">${costoFormato}</td>
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
