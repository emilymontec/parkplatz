const routes = {
    '/': {
        html: './src/views/login.html',
        css: './src/css/login.css',
        js: '../js/login.js',
        init: 'initLogin'
    },
};

async function loadRoute(path) {
    const route = routes[path] || routes['/'];
    const app = document.getElementById('app');

    try {
        // Cargar HTML
        const htmlResponse = await fetch(route.html);
        if (!htmlResponse.ok) throw new Error(`HTTP error! status: ${htmlResponse.status}`);
        const html = await htmlResponse.text();
        app.innerHTML = html;

        // Cargar CSS
        if (!document.querySelector(`link[href="${route.css}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = route.css;
            document.head.appendChild(link);
        }

        // Cargar y ejecutar JS
        if (route.js) {
            try {
                const module = await import(route.js);
                if (module && module[route.init]) {
                    module[route.init]();
                }
            } catch (jsError) {
                console.error("Error cargando módulo JS:", jsError);
            }
        }
    } catch (error) {
        console.error('Error cargando la vista:', error);
        app.innerHTML = '<p style="color:red; text-align:center; margin-top:20px;">Error cargando la vista. Asegúrate de servir este archivo desde un servidor web (http://...) y no directamente desde el sistema de archivos (file://...).</p>';
    }
}


// Navegación inicial
document.addEventListener('DOMContentLoaded', () => {
    loadRoute('/');
});
