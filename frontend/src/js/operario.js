import { getAuthHeaders, navigateTo, clearAuthSession, showConfirm, showAlert } from './routes.js';

let currentVehicles = []; // Almacen local para filtrado

export default function initOperator() {
    console.log('Operator Dashboard Ready');

    // 1. Mostrar info de usuario
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.username) {
        const nameEl = document.getElementById('userName');
        if (nameEl) nameEl.textContent = user.nombres_apellidos || user.username;
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
    loadVehicleTypes(); // Cargar tipos dinámicos
    loadVehicles();

    // 5. Lógica de Modal Entrada
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

    // New: Lógica de Modal Salida
    const exitModal = document.getElementById('exitModal');
    const btnExit = document.getElementById('btnExit');
    const btnCancelExit = document.getElementById('btnCancelExit');
    const exitForm = document.getElementById('exitForm');
    const btnSearchPlate = document.getElementById('btnSearchPlate');
    const btnBackSearch = document.getElementById('btnBackSearch');

    if (btnExit) {
        btnExit.onclick = () => {
            resetExitModal();
            if (exitModal) exitModal.style.display = 'flex';
        };
    }

    if (btnCancelExit && exitModal) {
        btnCancelExit.onclick = () => {
            exitModal.style.display = 'none';
        }
    }

    if (btnSearchPlate) {
        btnSearchPlate.onclick = async () => {
            const placa = document.getElementById('placaSearchInput').value.trim().toUpperCase();
            if (!placa) {
                await showAlert({ title: 'Error', message: 'Por favor ingrese una placa', type: 'warning' });
                return;
            }
            await calculateExit(placa);
        };
    }

    if (btnBackSearch) {
        btnBackSearch.onclick = () => {
            document.getElementById('stepSummary').style.display = 'none';
            document.getElementById('stepSearch').style.display = 'block';
        };
    }

    if (exitForm) {
        exitForm.onsubmit = async (e) => {
            e.preventDefault();
            const placa = document.getElementById('summaryPlaca').textContent;
            await processExit(placa);
        };
    }

    // Cerrar al hacer clic fuera del card
    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
        if (e.target === exitModal) exitModal.style.display = 'none';
    };

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

                // Confirmación visual detallada
                const reg = data.data; // El backend devuelve { message, data: { ... } }
                const horaEntrada = new Date(reg.entrada).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                const codigoEspacio = reg.espacios?.codigo || 'Sin Asignar';
                const tipoVehiculo = reg.tipos_vehiculo?.nombre || 'Vehículo';

                await showAlert({
                    title: 'Entrada Exitosa',
                    message: `🚗 Placa: ${reg.placa}\n📍 Espacio: ${codigoEspacio}\n🕒 Hora: ${horaEntrada}\n🚙 Tipo: ${tipoVehiculo}`,
                    type: 'success',
                    btnText: 'Entendido'
                });
                
                if (modal) modal.style.display = 'none';
                form.reset();
                loadVehicles();

            } catch (err) {
                await showAlert({
                    title: 'Error al Registrar',
                    message: err.message,
                    type: 'error'
                });
            } finally {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        };
    }

    // 7. Configurar Filtro de Búsqueda
    const searchInput = document.getElementById('searchPlaca');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.trim().toUpperCase();
            if (!term) {
                renderVehicles(currentVehicles);
                return;
            }
            const filtered = currentVehicles.filter(v => v.placa.includes(term));
            renderVehicles(filtered);
        });
    }
}

async function loadVehicleTypes() {
    const select = document.querySelector('select[name="tipo"]');
    if (!select) return;

    try {
        const res = await fetch('/api/registros/tipos-vehiculo', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!res.ok) throw new Error('Error al cargar tipos');

        const tipos = await res.json();
        
        select.innerHTML = '<option value="">Seleccione Categoría...</option>';
        tipos.forEach(tipo => {
            select.innerHTML += `<option value="${tipo.id_vehiculo}">${tipo.nombre}</option>`;
        });

    } catch (err) {
        console.error("Error loading vehicle types:", err);
        // Fallback or leave default options if any
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
        currentVehicles = vehicles; // Actualizar store local

        // Aplicar filtro si existe texto en el buscador
        const searchInput = document.getElementById('searchPlaca');
        if (searchInput && searchInput.value.trim()) {
            const term = searchInput.value.trim().toUpperCase();
            const filtered = currentVehicles.filter(v => v.placa.includes(term));
            renderVehicles(filtered);
        } else {
            renderVehicles(vehicles);
        }
        
        updateStats(vehicles.length);

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red; padding: 20px;">Error: ${err.message}</td></tr>`;
        updateStats(0); // Resetear stats en error
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
        const horaEntrada = new Date(v.entrada).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

        const tipoNombre = v.tipos_vehiculo?.nombre || 'Desconocido';

        return `
        <tr>
            <td><span class="plate-badge">${v.placa}</span></td>
            <td>${tipoNombre}</td>
            <td>${horaEntrada}</td>
            <td><span class="badge badge-success">En Patio</span></td>
            <td style="text-align: right;">
                <button class="btn btn-logout" 
                    title="Registrar Salida"
                    onclick="window.procesarSalida('${v.placa}')">
                    <i class="fa-solid fa-right-from-bracket"></i> Salida
                </button>
            </td>
        </tr>
    `}).join('');
}

function resetExitModal() {
    const input = document.getElementById('placaSearchInput');
    if (input) input.value = '';
    const stepSearch = document.getElementById('stepSearch');
    const stepSummary = document.getElementById('stepSummary');
    if (stepSearch) stepSearch.style.display = 'block';
    if (stepSummary) stepSummary.style.display = 'none';
}

async function calculateExit(placa) {
    const btn = document.getElementById('btnSearchPlate');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Calculando...';

    try {
        const res = await fetch(`/api/registros/preview-salida?placa=${placa}`, {
            headers: getAuthHeaders()
        });
        
        if (res.status === 404) {
            throw new Error('No se encontró vehículo activo con esta placa.');
        }
        
        const data = await res.json();
        
        // Populate Summary
        document.getElementById('summaryPlaca').textContent = data.placa;
        document.getElementById('summaryType').textContent = data.tipo_vehiculo || 'N/A';
        document.getElementById('summaryEntry').textContent = new Date(data.entrada).toLocaleTimeString('es-CO', {hour: '2-digit', minute:'2-digit'});
        document.getElementById('summaryExit').textContent = new Date(data.salida_estimada).toLocaleTimeString('es-CO', {hour: '2-digit', minute:'2-digit'});
        document.getElementById('summaryDuration').textContent = `${data.duracion_minutos} min`;
        document.getElementById('summaryTariff').textContent = data.tarifa_nombre;
        
        const totalFormatted = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(data.costo_total);
        document.getElementById('summaryTotal').textContent = totalFormatted;
        
        // Switch View
        document.getElementById('stepSearch').style.display = 'none';
        document.getElementById('stepSummary').style.display = 'block';

    } catch (err) {
        await showAlert({ title: 'Error', message: err.message, type: 'error' });
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function processExit(placa) {
    try {
        const res = await fetch('/api/registros/salida', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ placa })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al procesar salida');
        
        // Close modal
        document.getElementById('exitModal').style.display = 'none';
        
        // Show success
        await showAlert({
            title: 'Salida Exitosa',
            message: `Vehículo ${placa} retirado.\nCobro realizado: ${document.getElementById('summaryTotal').textContent}`,
            type: 'success',
            btnText: 'Aceptar'
        });
        
        loadVehicles(); // Refresh list
        
    } catch (err) {
        await showAlert({ title: 'Error', message: err.message, type: 'error' });
    }
}

// Función global para poder llamarla desde el HTML onclick
window.procesarSalida = (placa) => {
    const modal = document.getElementById('exitModal');
    if (modal) {
        resetExitModal();
        const input = document.getElementById('placaSearchInput');
        if (input) input.value = placa;
        modal.style.display = 'flex';
        calculateExit(placa); // Auto-calculate
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
    const headerCountEl = document.getElementById('vehiclesCountHeader');

    if (countEl) countEl.textContent = `${count}/${total}`;
    
    if (headerCountEl) {
        headerCountEl.textContent = `(${count} / ${total})`;
        headerCountEl.style.display = 'inline-block'; // Asegurar visibilidad
    }

    if (progressEl) {
        const percent = Math.min((count / total) * 100, 100);
        progressEl.style.width = `${percent}%`;
    }
}
