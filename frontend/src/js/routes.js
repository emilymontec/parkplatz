/**
 * routes.js - Router Central de la Aplicación (History API)
 * Gestiona la carga dinámica de vistas y controladores usando rutas limpias.
 * Incluye autenticación JWT y validación de roles.
 */

/**
 * Mostrar Alerta Personalizada (Reutiliza Modal de Confirmación)
 */
export const showAlert = ({ title, message, icon, btnText, type = 'info' }) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const iconEl = document.getElementById('confirmIcon');
        const okBtn = document.getElementById('confirmOkBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');
        const btnContainer = okBtn.parentElement; // El div grid

        if (!modal) return resolve();

        // Configurar contenido
        titleEl.textContent = title || 'Información';
        messageEl.textContent = message || '';
        messageEl.style.whiteSpace = 'pre-line'; // Permitir saltos de línea
        okBtn.textContent = btnText || 'Aceptar';

        // Ocultar botón cancelar y ajustar layout
        cancelBtn.style.display = 'none';
        btnContainer.style.gridTemplateColumns = '1fr';

        // Configurar icono y color
        let iconHtml = '<i class="fa-solid fa-circle-info"></i>';
        let color = 'var(--primary)';

        if (type === 'error') {
            iconHtml = '<i class="fa-solid fa-circle-xmark"></i>';
            color = 'var(--danger)';
        } else if (type === 'success') {
            iconHtml = '<i class="fa-solid fa-circle-check"></i>';
            color = 'var(--success)';
        } else if (type === 'warning') {
            iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>';
            color = 'var(--warning)';
        }

        iconEl.innerHTML = icon || iconHtml;
        iconEl.style.color = color;

        // Mostrar modal
        modal.classList.add('active');

        const cleanup = () => {
            modal.classList.remove('active');
            // Restaurar estilos por defecto para showConfirm
            setTimeout(() => {
                cancelBtn.style.display = 'block';
                btnContainer.style.gridTemplateColumns = '1fr 1fr';
                messageEl.style.whiteSpace = 'normal';
            }, 300);
            okBtn.onclick = null;
            resolve();
        };

        okBtn.onclick = () => cleanup();
    });
};

/**
 * Mostrar cuadro de confirmación personalizado
 */
export const showConfirm = ({ title, message, icon, okText, cancelText, type = 'warning' }) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const iconEl = document.getElementById('confirmIcon');
        const okBtn = document.getElementById('confirmOkBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');

        if (!modal) return resolve(false);

        // Configurar contenido
        titleEl.textContent = title || '¿Estás seguro?';
        messageEl.textContent = message || 'Esta acción requiere confirmación.';
        okBtn.textContent = okText || 'Confirmar';
        cancelBtn.textContent = cancelText || 'Cancelar';

        // Configurar icono y color según tipo
        let iconHtml = '<i class="fa-solid fa-circle-question"></i>';
        let color = 'var(--warning)';

        if (type === 'danger') {
            iconHtml = '<i class="fa-solid fa-circle-exclamation"></i>';
            color = 'var(--danger)';
        } else if (type === 'success') {
            iconHtml = '<i class="fa-solid fa-circle-check"></i>';
            color = 'var(--success)';
        }

        iconEl.innerHTML = icon || iconHtml;
        iconEl.style.color = color;

        // Mostrar modal
        modal.classList.add('active');

        const cleanup = (result) => {
            modal.classList.remove('active');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(result);
        };

        okBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
    });
};

// Configuración de rutas
const routes = {
    '/': {
        view: '/src/views/login.html',
        styles: ['/src/css/login.css'],
        title: 'Login - Parkplatz',
        controller: './login.js',
        initFn: 'initLogin',
        public: true // Ruta pública (sin token)
    },
    '/login': {
        view: '/src/views/login.html',
        styles: ['/src/css/login.css'],
        title: 'Login - Parkplatz',
        controller: './login.js',
        initFn: 'initLogin',
        public: true
    },
    '/admin': {
        view: '/src/views/admin/dashboard.html',
        styles: ['/src/css/global.css', '/src/css/admin.css'],
        title: 'Administración - Parkplatz',
        role: 'ADMINISTRADOR',
        controller: './admin.js',
        initFn: 'initAdmin'
    },
    '/admin/users': {
        view: '/src/views/admin/users.html',
        styles: ['/src/css/global.css', '/src/css/admin.css'],
        title: 'Gestión Usuarios - Parkplatz',
        role: 'ADMINISTRADOR',
        controller: './users.js',
        initFn: 'initUsers'
    },
    '/admin/tarifas': {
        view: '/src/views/admin/tarifas.html',
        styles: ['/src/css/global.css', '/src/css/admin.css'],
        title: 'Gestión Tarifas - Parkplatz',
        role: 'ADMINISTRADOR',
        controller: './tarifas.js',
        initFn: 'initTarifas'
    },
    '/operario': {
        view: '/src/views/operario/dashboard.html',
        styles: ['/src/css/global.css', '/src/css/operario.css'],
        title: 'Operación - Parkplatz',
        role: 'OPERARIO',
        controller: './operario.js',
        initFn: 'initOperator'
    },
    '/operario/perfil': {
        view: '/src/views/operario/profile.html',
        styles: ['/src/css/global.css', '/src/css/operario.css'],
        title: 'Perfil Operario - Parkplatz',
        role: 'OPERARIO',
        controller: './operario_profile.js',
        initFn: 'default'
    }
};

/**
 * Validar y forzar cambio de contraseña
 */
function checkForcePasswordChange(user, path) {
    if (user && user.mustChangePassword) {
        // Verificar si ya existe el modal, si no, crearlo
        let modal = document.getElementById('forceChangePasswordModal');
        if (!modal) {
            createForceChangePasswordModal();
        }
    }
}

function createForceChangePasswordModal() {
    const modalHtml = `
    <div id="forceChangePasswordModal" class="modal-overlay active" style="z-index: 9999; display: flex;">
        <div class="modal-content" style="max-width: 450px;">
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; color: var(--warning);"></i>
                <h2 style="margin-top: 1rem;">Cambio de Contraseña Obligatorio</h2>
                <p style="color: var(--text-muted);">Por seguridad, debes cambiar tu contraseña predeterminada antes de continuar.</p>
            </div>
            
            <form id="forceChangePasswordForm">
                <div class="input-group">
                    <label>Contraseña Actual</label>
                    <div class="input-icon-container">
                        <i class="fa-solid fa-lock input-icon"></i>
                        <input type="password" id="forceCurrentPassword" class="input-field input-with-icon" placeholder="Ingresa tu contraseña actual" required>
                    </div>
                </div>
                <div class="input-group">
                    <label>Nueva Contraseña</label>
                    <div class="input-icon-container">
                        <i class="fa-solid fa-key input-icon"></i>
                        <input type="password" id="forceNewPassword" class="input-field input-with-icon" placeholder="Nueva contraseña" required minlength="6">
                    </div>
                </div>
                <div class="input-group">
                    <label>Confirmar Nueva Contraseña</label>
                    <div class="input-icon-container">
                        <i class="fa-solid fa-check-double input-icon"></i>
                        <input type="password" id="forceConfirmPassword" class="input-field input-with-icon" placeholder="Repite la nueva contraseña" required minlength="6">
                    </div>
                </div>
                <div style="text-align: right; margin-top: 1.5rem;">
                     <button type="submit" class="btn btn-primary" style="width: 100%;">Actualizar y Continuar</button>
                </div>
            </form>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const form = document.getElementById('forceChangePasswordForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentPassword = document.getElementById('forceCurrentPassword').value;
        const newPassword = document.getElementById('forceNewPassword').value;
        const confirmNewPassword = document.getElementById('forceConfirmPassword').value;

        if (newPassword !== confirmNewPassword) {
            await showAlert({ title: 'Error', message: 'Las contraseñas no coinciden', type: 'error' });
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                await showAlert({ title: 'Éxito', message: 'Contraseña actualizada. Inicia sesión nuevamente.', type: 'success' });
                clearAuthSession();
                window.location.href = '/';
            } else {
                await showAlert({ title: 'Error', message: data.error || 'Error al actualizar', type: 'error' });
            }
        } catch (err) {
            console.error(err);
            await showAlert({ title: 'Error', message: 'Error de conexión', type: 'error' });
        }
    });
}

/**
 * Función para navegar a una ruta (History API)
 */
export const navigateTo = (path) => {
    window.history.pushState(null, null, path);
    router();
};

/**
 * Obtener token JWT del localStorage
 */
export const getAuthToken = () => {
    return localStorage.getItem('authToken');
};

/**
 * Obtener headers con autenticación JWT
 */
export const getAuthHeaders = () => {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json'
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
};

/**
 * Verificar token con el backend
 */
const verifyTokenWithBackend = async () => {
    const token = getAuthToken();

    if (!token) {
        return null;
    }

    try {
        const res = await fetch('/api/auth/verify', {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            // Token inválido o expirado
            clearAuthSession();
            return null;
        }

        const data = await res.json();
        return data.user;

    } catch (err) {
        console.error('Error verificando token:', err);
        return null;
    }
};

/**
 * Limpiar sesión de autenticación
 */
export const clearAuthSession = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
};

/**
 * Motor del Router
 */
const router = async () => {
    // 1. Obtener ruta actual (Pathname)
    let path = window.location.pathname;

    // Normalizar ruta (limpiar barras extras al final, excepto si es raíz)
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

    // 2. Gestión de Sesión - Verificar token con backend
    let user = null;
    const token = getAuthToken();

    if (token) {
        // Verificar que el token aún sea válido en el backend
        user = await verifyTokenWithBackend();

        if (!user) {
            // Token expirado o inválido, limpiar sesión
            console.warn('Token inválido o expirado');
            if (path !== '/' && path !== '/login') {
                navigateTo('/');
                return;
            }
        }
    }

    // 3. Redirecciones automáticas (Auth Guard)
    const config = routes[path];

    // Si la ruta no es pública y el usuario no está autenticado
    if (!config?.public && !user && path !== '/') {
        console.warn(`Acceso denegado: Se requiere autenticación para ${path}`);
        navigateTo('/');
        return;
    }

    // Verificar si debe cambiar contraseña (para usuarios autenticados)
    if (user && !config?.public) {
        checkForcePasswordChange(user, path);
    }

    // Si el usuario está autenticado y trata de acceder a login
    if (user && (path === '/' || path === '/login')) {
        if (user.rol === 'ADMINISTRADOR') navigateTo('/admin');
        else if (user.rol === 'OPERARIO') navigateTo('/operario');
        return;
    }

    // 4. Buscar configuración de la ruta
    if (!config) {
        console.warn(`Ruta no definida: ${path}`);
        // Opcional: Mostrar página 404 o redirigir
        navigateTo('/');
        return;
    }

    // 5. Verificar Permisos de Rol
    if (config.role && user) {
        const userRole = (user.rol || '').toUpperCase();
        const requiredRole = config.role.toUpperCase();

        if (userRole !== requiredRole) {
            console.warn(`Acceso denegado: Se requiere ${requiredRole}, usuario es ${userRole}`);
            
            await showAlert({
                title: 'Acceso Denegado',
                message: 'No tienes permiso para acceder a esta vista.',
                type: 'error'
            });

            // Redirigir según el rol real del usuario
            if (userRole === 'ADMINISTRADOR') navigateTo('/admin');
            else if (userRole === 'OPERARIO') navigateTo('/operario');
            else navigateTo('/');
            return;
        }
    }

    // 6. Preparar UI
    const app = document.getElementById('app');
    const loader = document.getElementById('loader');

    if (loader) loader.style.opacity = '1';
    document.title = config.title;

    try {
        // 7. Cargar Estilos Dinámicos
        updateStyles(config.styles);

        // 8. Cargar Plantilla HTML (View)
        const response = await fetch(config.view);
        if (!response.ok) throw new Error(`Status ${response.status}: No se pudo cargar la vista`);
        const html = await response.text();

        // Inyectar HTML
        app.innerHTML = html;

        // 9. Cargar y Ejecutar Controlador JS
        if (config.controller) {
            try {
                const module = await import(config.controller);
                const initFunction = module.default || module[config.initFn];

                if (typeof initFunction === 'function') {
                    await initFunction();
                } else {
                    console.warn(`Controlador no encontrado: ${config.controller}`);
                }
            } catch (e) {
                console.error(`Error cargando controlador:`, e);
            }
        }

        // Finalizar carga
        if (loader) {
            setTimeout(() => {
                loader.style.opacity = '0';
                setTimeout(() => loader.style.display = 'none', 500);
            }, 300);
        }

    } catch (error) {
        console.error('Error en Router:', error);

        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
        }

        app.innerHTML = `
            <div style="background: #111; color: white; padding: 50px; text-align: center; font-family: sans-serif; border: 1px solid #333; margin: 20px; border-radius: 12px;">
                <h2 style="color: #FF7F00; margin-bottom: 15px;">Error de Carga</h2>
                <p style="margin-bottom: 20px;">${error.message}</p>
                <button onclick="location.reload()" style="padding: 12px 24px; background: #FF7F00; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
                    🔄 Reintentar
                </button>
            </div>`;
    }
};

/**
 * Actualiza los enlaces CSS en el head
 */
function updateStyles(hrefs) {
    // Elimina estilos dinámicos previos
    document.querySelectorAll('link[data-dynamic-css]').forEach(el => el.remove());

    const styleList = Array.isArray(hrefs) ? hrefs : [hrefs];
    styleList.forEach(href => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute('data-dynamic-css', 'true');
        document.head.appendChild(link);
    });
}

// Función para configurar listeners de inactividad (logout automático)
function setupInactivityListeners() {
    let inactivityTimer;
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos

    const resetTimer = () => {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            const token = getAuthToken();
            if (token) {
                console.warn('Sesión cerrada por inactividad');
                clearAuthSession();
                navigateTo('/');
            }
        }, INACTIVITY_TIMEOUT);
    };

    // Eventos de actividad
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetTimer, true);
    });

    // Iniciar timer
    resetTimer();
}

// Interceptor de clics para navegación SPA
document.addEventListener('click', e => {
    // Buscar si el clic fue en un enlace (o hijo de un enlace)
    const link = e.target.closest('a');

    if (link) {
        const href = link.getAttribute('href');

        // Si es un enlace interno (comienza con /) y no es externo/anchor
        if (href && href.startsWith('/') && !href.startsWith('//') && !link.target) {
            e.preventDefault();
            navigateTo(href);
        }
    }
});

// Eventos de Navegación (History API)
window.addEventListener('popstate', router);

// Inicio de la Aplicación
const initApp = () => {
    setupInactivityListeners(); // Iniciar listeners de inactividad

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', router);
    } else {
        router();
    }
};

initApp();
