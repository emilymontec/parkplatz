import { getAuthHeaders, clearAuthSession, navigateTo } from './routes.js';

export const initUsers = async () => {
    // Cargar usuarios iniciales
    await loadUsers();

    // Event Listeners
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        clearAuthSession();
        navigateTo('/');
    });

    document.getElementById('btnCreateUser')?.addEventListener('click', () => {
        openModal();
    });

    document.getElementById('btnCancelModal')?.addEventListener('click', () => {
        closeModal();
    });

    document.getElementById('userForm')?.addEventListener('submit', handleFormSubmit);

    // Cerrar modal al hacer click fuera
    window.onclick = (event) => {
        const modal = document.getElementById('userModal');
        if (event.target === modal) {
            closeModal();
        }
    };

    // Set user info in navbar (similar to admin.js)
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.username) {
        const userNameEl = document.getElementById('userName');
        const userInitialsEl = document.getElementById('userInitials');

        if (userNameEl) userNameEl.textContent = user.nombres_apellidos || user.username;
        if (userInitialsEl) userInitialsEl.textContent = (user.username[0] || 'A').toUpperCase();
    }
};

const loadUsers = async () => {
    try {
        const res = await fetch('/api/admin/usuarios', {
            headers: getAuthHeaders()
        });

        if (!res.ok) throw new Error('Error cargando usuarios');

        const users = await res.json();
        renderTable(users);
    } catch (err) {
        console.error(err);
        const tbody = document.getElementById('usersTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr><td colspan="6" style="text-align: center; color: red;">Error al cargar usuarios</td></tr>
            `;
        }
    }
};

const renderTable = (users) => {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No hay usuarios registrados</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>
                <div style="font-weight: 500;">${user.username}</div>
            </td>
            <td>${user.email}</td>
            <td>
                <span class="badge" 
                      style="padding: 4px 8px; border-radius: 4px; font-size: 12px; 
                      background: ${user.rol === 'ADMINISTRADOR' ? '#e3f2fd' : '#f5f5f5'}; 
                      color: ${user.rol === 'ADMINISTRADOR' ? '#1976d2' : '#616161'};">
                    ${user.rol}
                </span>
            </td>
            <td>${user.nombres_apellidos}</td>
            <td>
                <span style="color: ${user.activo ? 'var(--success)' : 'var(--danger)'}; font-weight: 500;">
                    ${user.activo ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>
                <button onclick="window.editUser('${user.id_usuario}')" title="Editar" style="background: none; border: none; cursor: pointer; font-size: 16px; margin-right: 10px;">
                    ✏️
                </button>
                <button onclick="window.toggleUser('${user.id_usuario}', ${user.activo})" title="${user.activo ? 'Desactivar' : 'Activar'}" style="background: none; border: none; cursor: pointer; font-size: 16px;">
                    ${user.activo ? '🚫' : '✅'}
                </button>
            </td>
        </tr>
    `).join('');

    // Expose functions to window for onclick handlers
    window.editUser = (id) => {
        const user = users.find(u => u.id_usuario == id);
        if (user) openModal(user);
    };

    window.toggleUser = async (id, currentStatus) => {
        if (!confirm(`¿Estás seguro de ${currentStatus ? 'desactivar' : 'activar'} este usuario?`)) return;

        try {
            const res = await fetch(`/api/admin/usuarios/${id}/toggle`, {
                method: 'PATCH',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: id, activo: !currentStatus })
            });

            if (res.ok) {
                loadUsers();
            } else {
                alert('Error al cambiar estado');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión');
        }
    };
};

const openModal = (user = null) => {
    const modal = document.getElementById('userModal');
    const form = document.getElementById('userForm');
    const title = document.getElementById('modalTitle');
    const passwordHelp = document.getElementById('passwordHelp');

    modal.style.display = 'flex';
    form.reset();

    if (user) {
        title.textContent = 'Editar Usuario';
        document.getElementById('userId').value = user.id_usuario;
        document.getElementById('nombres_apellidos').value = user.nombres_apellidos;
        document.getElementById('username').value = user.username;
        document.getElementById('email').value = user.email;
        // Mapeo simple de roles (1: ADMIN, 2: OPERARIO) - Ajustar según DB real
        const roleId = user.rol_id || (user.rol === 'ADMINISTRADOR' ? 1 : 2);
        document.getElementById('rol_id').value = roleId;

        document.getElementById('password').required = false;
        passwordHelp.textContent = 'Dejar en blanco para mantener la actual.';
    } else {
        title.textContent = 'Crear Usuario';
        document.getElementById('userId').value = '';

        document.getElementById('password').required = true;
        passwordHelp.textContent = 'Requerida para crear.';
    }
};

const closeModal = () => {
    document.getElementById('userModal').style.display = 'none';
};

const handleFormSubmit = async (e) => {
    e.preventDefault();

    const userId = document.getElementById('userId').value;
    const isEdit = !!userId;

    const formData = {
        nombres_apellidos: document.getElementById('nombres_apellidos').value,
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        rol_id: parseInt(document.getElementById('rol_id').value),
        password: document.getElementById('password').value
    };

    if (!formData.password) delete formData.password;

    try {
        const url = isEdit ? `/api/admin/usuarios/${userId}` : '/api/admin/usuarios';
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Error al guardar usuario');
        }

        closeModal();
        loadUsers();
        alert(isEdit ? 'Usuario actualizado' : 'Usuario creado exitosamente');

    } catch (err) {
        console.error(err);
        alert(err.message);
    }
};
