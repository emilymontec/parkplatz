import { getAuthHeaders, navigateTo, clearAuthSession } from './routes.js';

let tarifas = [];
let tiposVehiculo = [];
let currentTarifaId = null;

export default function initTarifas() {
    console.log('Tarifas Management Ready');
    
    setupUser();
    loadTiposVehiculo(); // Cargar tipos antes de tarifas para tenerlos disponibles
    loadTarifas();
    setupModal();
}

function setupUser() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.username) {
        const nameEl = document.getElementById('userName');
        if (nameEl) nameEl.textContent = user.nombres_apellidos || user.username;
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            clearAuthSession();
            navigateTo('/login');
        });
    }
}

async function loadTiposVehiculo() {
    const select = document.getElementById('tipoVehiculo');
    
    try {
        const res = await fetch('/api/admin/tipos-vehiculo', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!res.ok) throw new Error('Error al cargar tipos de vehículo');

        tiposVehiculo = await res.json();
        
        // Poblar select
        select.innerHTML = '<option value="">Seleccione...</option>';
        tiposVehiculo.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo.id_vehiculo; // Corregido según entitys.sql
            option.textContent = tipo.nombre;
            select.appendChild(option);
        });

    } catch (err) {
        console.error("Error loading vehicle types:", err);
        select.innerHTML = '<option value="">Error cargando datos</option>';
    }
}

async function loadTarifas() {
    const tableBody = document.getElementById('tarifasTableBody');
    
    try {
        const res = await fetch('/api/admin/tarifas', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (res.status === 401) {
            clearAuthSession();
            navigateTo('/login');
            return;
        }

        if (!res.ok) throw new Error('Error al cargar tarifas');

        tarifas = await res.json();
        renderTable();

    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--danger); padding: 40px;">
                    Error cargando datos: ${err.message}
                </td>
            </tr>
        `;
    }
}

function renderTable() {
    const tableBody = document.getElementById('tarifasTableBody');
    if (!tableBody) return;

    if (tarifas.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 40px;">
                    No hay tarifas registradas.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = tarifas.map(tarifa => {
        const valorFormatted = new Intl.NumberFormat('es-CO', { 
            style: 'currency', 
            currency: 'COP',
            maximumFractionDigits: 0
        }).format(tarifa.valor);

        const tipoCobroMap = {
            'POR_MINUTO': 'Minuto',
            'POR_HORA': 'Hora',
            'POR_DIA': 'Día',
            'FRACCION': 'Fracción (15m)'
        };

        const fechaInicio = new Date(tarifa.fecha_inicio).toLocaleDateString('es-CO');
        const fechaFin = tarifa.fecha_fin ? new Date(tarifa.fecha_fin).toLocaleDateString('es-CO') : 'Indefinida';
        
        // Icon logic
        const tipoNombre = (tarifa.tipos_vehiculo?.nombre || '').toLowerCase();
        let icon = 'fa-car-side';
        let iconBg = '#EFF6FF'; // Blueish
        let iconColor = '#2563EB';

        if (tipoNombre.includes('moto')) {
            icon = 'fa-motorcycle';
            iconBg = '#FFF7ED'; // Orangeish
            iconColor = '#EA580C';
        }

        return `
            <tr>
                <td>
                    <div class="user-cell-info">
                        <div class="user-avatar-sm" style="background: ${iconBg}; color: ${iconColor}; font-size: 1rem;">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div>
                            <div style="font-weight: 600; color: var(--text-main);">${tarifa.nombre}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 500;">
                                ${tarifa.tipos_vehiculo?.nombre || 'General'}
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge" style="background: #F8FAFC; border: 1px solid var(--border); color: var(--text-main); font-weight: 500;">
                        ${tipoCobroMap[tarifa.tipo_cobro] || tarifa.tipo_cobro}
                    </span>
                </td>
                <td>
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">${valorFormatted}</div>
                </td>
                <td>
                    <div style="font-size: 0.75rem; display: flex; flex-direction: column; gap: 4px;">
                        <span style="display: flex; align-items: center; gap: 6px; color: var(--text-main);">
                            <i class="fa-regular fa-calendar-check" style="color: var(--success);"></i> ${fechaInicio}
                        </span>
                        <span style="display: flex; align-items: center; gap: 6px; color: var(--text-muted);">
                            <i class="fa-regular fa-calendar-xmark" style="color: var(--text-light);"></i> ${fechaFin}
                        </span>
                    </div>
                </td>
                <td>
                    <span style="color: ${tarifa.activo ? 'var(--success)' : 'var(--danger)'}; font-weight: 600; font-size: 0.875rem;">
                        ${tarifa.activo ? 'Activa' : 'Inactiva'}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="btn-action" onclick="window.editTarifa(${tarifa.id_tarifa})" title="Editar">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button class="btn-action ${tarifa.activo ? 'btn-toggle-off' : 'btn-toggle-on'}" 
                                onclick="window.toggleTarifa(${tarifa.id_tarifa}, ${!tarifa.activo})" 
                                title="${tarifa.activo ? 'Desactivar' : 'Activar'}">
                            <i class="fa-solid ${tarifa.activo ? 'fa-ban' : 'fa-check'}"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function setupModal() {
    const modal = document.getElementById('tarifaModal');
    const btnCreate = document.getElementById('btnCreateTarifa');
    const btnClose = document.getElementById('modalClose');
    const form = document.getElementById('tarifaForm');

    // Open Modal
    if (btnCreate) {
        btnCreate.addEventListener('click', () => {
            currentTarifaId = null;
            document.getElementById('modalTitle').textContent = 'Nueva Tarifa';
            form.reset();
            // Set default date to today
            document.getElementById('fechaInicio').valueAsDate = new Date();
            modal.classList.add('active');
        });
    }

    // Close Modal
    if (btnClose) {
        btnClose.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    // Submit Form
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            nombre: document.getElementById('nombre').value,
            tipo_vehiculo_id: document.getElementById('tipoVehiculo').value,
            tipo_cobro: document.getElementById('tipoCobro').value,
            valor: parseFloat(document.getElementById('valor').value),
            fecha_inicio: document.getElementById('fechaInicio').value,
            fecha_fin: document.getElementById('fechaFin').value || null
        };

        try {
            const url = currentTarifaId 
                ? `/api/admin/tarifas/${currentTarifaId}`
                : '/api/admin/tarifas';
            
            const method = currentTarifaId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Error al guardar tarifa');
            }

            modal.classList.remove('active');
            loadTarifas();
            // Show success toast (implement toast later)
            alert(currentTarifaId ? 'Tarifa actualizada' : 'Tarifa creada');

        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    });

    // Expose functions globally for onclick events
    window.editTarifa = (id) => {
        const tarifa = tarifas.find(t => t.id_tarifa === id);
        if (!tarifa) return;

        currentTarifaId = id;
        document.getElementById('modalTitle').textContent = 'Editar Tarifa';
        
        document.getElementById('nombre').value = tarifa.nombre;
        document.getElementById('tipoVehiculo').value = tarifa.tipo_vehiculo_id;
        document.getElementById('tipoCobro').value = tarifa.tipo_cobro;
        document.getElementById('valor').value = tarifa.valor;
        document.getElementById('fechaInicio').value = tarifa.fecha_inicio.split('T')[0];
        document.getElementById('fechaFin').value = tarifa.fecha_fin ? tarifa.fecha_fin.split('T')[0] : '';

        modal.classList.add('active');
    };

    window.toggleTarifa = async (id, nuevoEstado) => {
        if (!confirm(`¿Estás seguro de ${nuevoEstado ? 'activar' : 'desactivar'} esta tarifa?`)) return;

        try {
            const res = await fetch(`/api/admin/tarifas/${id}/toggle`, {
                method: 'PATCH',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ activo: nuevoEstado })
            });

            if (!res.ok) throw new Error('Error al cambiar estado');

            loadTarifas();

        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    };
}
