import { getAuthHeaders, navigateTo, clearAuthSession, showConfirm, showAlert } from './routes.js';

let currentVehicles = []; // Almacen local para filtrado

export default function initOperator() {

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

    const btnCloseReceipt = document.getElementById('btnCloseReceipt');
    const btnPrintReceipt = document.getElementById('btnPrintReceipt');

    if (btnCloseReceipt) {
        btnCloseReceipt.onclick = () => {
            document.getElementById('exitModal').style.display = 'none';
            resetExitModal();
        };
    }

    if (btnPrintReceipt) {
        btnPrintReceipt.onclick = () => {
            printReceipt();
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

            // Validación de formato de placa en frontend
            const plateRegex = /^[A-Z]{3}[0-9]{2}[A-Z0-9]$/;
            if (!plateRegex.test(placa)) {
                await showAlert({
                    title: 'Formato Inválido',
                    message: 'La placa debe tener el formato AAA123 o AAA12B',
                    type: 'warning'
                });
                btn.disabled = false;
                btn.innerText = originalText;
                return;
            }

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
                const codigoEspacio = reg.espacios?.codigo || 'Sin asignar';
                const tipoVehiculo = reg.tipos_vehiculo?.nombre || 'Vehículo';

                await showAlert({
                    title: 'Entrada exitosa',
                    message: `Placa: ${reg.placa}\nEspacio: ${codigoEspacio}\nHora: ${horaEntrada}\nTipo: ${tipoVehiculo}`,
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
        
        updateQuotaStats();

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red; padding: 20px;">Error: ${err.message}</td></tr>`;
        updateQuotaStats(); // Intentar actualizar incluso si falla la lista
    }
}

function renderVehicles(vehicles) {
    const tbody = document.getElementById('vehiclesBody');
    if (!tbody) return;

    if (vehicles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #666;">No hay vehículos en el parqueadero</td></tr>';
        return;
    }

    tbody.innerHTML = vehicles.map(v => {
        const entrada = new Date(v.entrada);
        const ahora = new Date();
        
        // Calcular diferencia asegurando no negativos
        let diffMs = ahora - entrada;
        if (diffMs < 0) diffMs = 0;
        
        const diffMins = Math.floor(diffMs / 60000);
        
        let tiempoTexto = 'Hace un momento';
        
        // CORRECCIÓN: Mostrar siempre los minutos, incluso si es 0
        if (diffMins >= 0) {
            const horas = Math.floor(diffMins / 60);
            const minutos = diffMins % 60;
            if (horas > 0) {
                tiempoTexto = `${horas}h ${minutos}m`;
            } else {
                tiempoTexto = `${minutos} min`;
            }
        } else {
             // Caso borde: Reloj desincronizado (futuro)
             tiempoTexto = '0 min';
        }

        // Formatear hora forzando zona horaria Colombia
        const horaEntrada = entrada.toLocaleTimeString('es-CO', { 
            timeZone: 'America/Bogota',
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
        
        const tipoNombre = v.tipos_vehiculo?.nombre || 'Desconocido';

        return `
        <tr>
            <td><span class="plate-badge">${v.placa}</span></td>
            <td>${tipoNombre}</td>
            <td>${horaEntrada}</td>
            <td><span style="font-weight: 600; color: var(--text-lead);"><i class="fa-regular fa-clock"></i> ${tiempoTexto}</span></td>
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
    const stepReceipt = document.getElementById('stepReceipt');
    
    if (stepSearch) stepSearch.style.display = 'block';
    if (stepSummary) stepSummary.style.display = 'none';
    if (stepReceipt) stepReceipt.style.display = 'none';
    
    // Clear receipt data
    const qr = document.getElementById('receiptQR');
    if (qr) qr.innerHTML = '';
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
        
        // Show Receipt Step instead of closing
        showReceipt(data);
        
        loadVehicles(); // Refresh list in background
        
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

async function updateQuotaStats() {
    try {
        const res = await fetch('/api/registros/cupos', {
            headers: getAuthHeaders()
        });
        
        if (!res.ok) return;

        const data = await res.json();
        // data structure: { autos: {active, total}, motos: {active, total}, total: {active, limit} }

        const countEl = document.getElementById('occupancyCount');
        const progressEl = document.getElementById('occupancyProgress');
        const autoStatsEl = document.getElementById('autoStats');
        const motoStatsEl = document.getElementById('motoStats');

        if (countEl) countEl.textContent = `${data.total.active}/${data.total.limit}`;
        
        if (autoStatsEl) {
             autoStatsEl.innerHTML = `<i class="fa-solid fa-car"></i> ${data.autos.active}/${data.autos.total}`;
             autoStatsEl.style.color = data.autos.active >= data.autos.total ? 'var(--danger)' : 'inherit';
             if (data.autos.active >= data.autos.total) autoStatsEl.style.fontWeight = 'bold';
        }
        if (motoStatsEl) {
             motoStatsEl.innerHTML = `<i class="fa-solid fa-motorcycle"></i> ${data.motos.active}/${data.motos.total}`;
             motoStatsEl.style.color = data.motos.active >= data.motos.total ? 'var(--danger)' : 'inherit';
             if (data.motos.active >= data.motos.total) motoStatsEl.style.fontWeight = 'bold';
        }

        if (progressEl) {
            const percent = Math.min((data.total.active / data.total.limit) * 100, 100);
            progressEl.style.width = `${percent}%`;
            
            if (percent >= 100) {
                progressEl.style.backgroundColor = 'var(--danger)';
            } else if (percent > 80) {
                progressEl.style.backgroundColor = 'var(--warning)';
            } else {
                progressEl.style.backgroundColor = 'var(--primary)';
            }
        }

    } catch (err) {
        console.error("Error updating quota stats:", err);
    }
}

function showReceipt(data) {
    // Hide others
    document.getElementById('stepSearch').style.display = 'none';
    document.getElementById('stepSummary').style.display = 'none';
    document.getElementById('stepReceipt').style.display = 'block';

    const reg = data.data; // Updated record
    const ticketId = reg.id_registro;
    const entrada = new Date(reg.entrada);
    const salida = new Date(reg.salida);
    
    document.getElementById('receiptTicket').textContent = ticketId;
    document.getElementById('receiptPlaca').textContent = reg.placa;
    document.getElementById('receiptEntry').textContent = entrada.toLocaleTimeString('es-CO', {hour: '2-digit', minute:'2-digit'});
    document.getElementById('receiptExit').textContent = salida.toLocaleTimeString('es-CO', {hour: '2-digit', minute:'2-digit'});
    document.getElementById('receiptDuration').textContent = `${data.duracion_minutos} min`;
    document.getElementById('receiptIdText').textContent = ticketId;
    
    const totalFormatted = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(data.costo_total);
    document.getElementById('receiptTotal').textContent = totalFormatted;

    // Generate QR
    const qrContainer = document.getElementById('receiptQR');
    qrContainer.innerHTML = ''; // Clear previous
    try {
        if (window.QRCode) {
            new QRCode(qrContainer, {
                text: ticketId.toString(),
                width: 128,
                height: 128,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        } else {
            qrContainer.textContent = "QR Lib Missing";
        }
    } catch (e) {
        console.error("Error generating QR", e);
        qrContainer.textContent = "Error QR";
    }
}

function printReceipt() {
    const content = document.getElementById('receiptContent').innerHTML;
    const win = window.open('', '', 'height=600,width=400');
    win.document.write('<html><head><title>Comprobante</title>');
    // Basic print styles
    win.document.write(`
        <style>
            body { font-family: 'Courier New', monospace; text-align: center; padding: 20px; } 
            #receiptQR { margin: 20px auto; display: flex; justify-content: center; }
            #receiptQR img { margin: 0 auto; }
            h3 { border-bottom: 2px solid black; padding-bottom: 10px; }
            div { margin: 5px 0; }
            .total { font-size: 1.5em; font-weight: bold; margin-top: 15px; }
        </style>
    `);
    win.document.write('</head><body>');
    win.document.write(content);
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    setTimeout(() => {
        win.print();
        win.close();
    }, 500);
}
