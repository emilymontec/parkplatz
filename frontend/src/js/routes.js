/**
 * routes.js - Router Central de la Aplicación
 * Gestiona la carga dinámica de vistas y controladores.
 * Incluye autenticación JWT y validación de roles.
 */

// Configuración de rutas
const routes = {
    '/': {
        view: 'src/views/login.html',
        styles: ['src/css/login.css'],
        title: 'Login - Parkplatz',
        controller: './login.js',
        initFn: 'initLogin',
        public: true // Ruta pública (sin token)
    },
    '/admin': {
        view: 'src/views/admin/dashboard.html',
        styles: ['src/css/global.css', 'src/css/admin.css'],
        title: 'Administración - Parkplatz',
        role: 'ADMINISTRADOR',
        controller: './admin.js',
        initFn: 'initAdmin'
    },
    '/operator': {
        view: 'src/views/operator/dashboard.html',
        styles: ['src/css/global.css', 'src/css/operator.css'],
        title: 'Operación - Parkplatz',
        role: 'OPERARIO',
        controller: './operator.js',
        initFn: 'initOperator'
    }
};

/**
 * Función para navegar a una ruta mediante hash
 */
export const navigateTo = (path) => {
    window.location.hash = path;
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
    // 1. Obtener ruta actual del hash o por defecto '/'
    let path = window.location.hash.slice(1) || '/';

    // Normalizar ruta (limpiar barras extras)
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
            if (path !== '/') {
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

    // Si el usuario está autenticado y trata de acceder a login
    if (user && path === '/') {
        if (user.rol === 'ADMINISTRADOR') navigateTo('/admin');
        else if (user.rol === 'OPERARIO') navigateTo('/operator');
        return;
    }

    // 4. Buscar configuración de la ruta
    if (!config) {
        console.warn(`Ruta no definida: ${path}`);
        navigateTo('/');
        return;
    }

    // 5. Verificar Permisos de Rol
    if (config.role && user) {
        const userRole = (user.rol || '').toUpperCase();
        const requiredRole = config.role.toUpperCase();

        if (userRole !== requiredRole) {
            console.warn(`Acceso denegado: Se requiere ${requiredRole}, usuario es ${userRole}`);
            alert('No tienes permiso para acceder a esta vista');
            
            // Redirigir según el rol real del usuario
            if (userRole === 'ADMINISTRADOR') navigateTo('/admin');
            else if (userRole === 'OPERARIO') navigateTo('/operator');
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

// Eventos de Navegación
window.onhashchange = router;

// Inicio de la Aplicación
const initApp = () => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', router);
    } else {
        router();
    }
};

initApp();
