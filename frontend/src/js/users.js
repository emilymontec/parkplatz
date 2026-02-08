import { getAuthHeaders, clearAuthSession, navigateTo, showConfirm } from './routes.js';

export const initUsers = async () => {
    // Cargar roles y usuarios iniciales
    await loadRoles();
    await loadUsers();

    // Event Listeners
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        clearAuthSession();
        navigateTo('/');
    });

    document.getElementById('btnCreateUser')?.addEventListener('click', () => {
        openModal();
    });

    document.getElementById('btnCancelModal')?.addEventListener('click', closeModal);
    document.getElementById('btnCancelBottom')?.addEventListener('click', closeModal);

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

        if (userNameEl) userNameEl.textContent = user.nombres_apellidos || user.username;
    }
};

const loadRoles = async () => {
    try {
        const res = await fetch('/api/admin/roles', {
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            throw new Error(`Error HTTP: ${res.status}`);
        }

        const roles = await res.json();
        const rolSelect = document.getElementById('rol_id');

        if (rolSelect) {
            rolSelect.innerHTML = roles.map(rol =>
                `<option value="${rol.id_roles}">${rol.nombre}</option>`
            ).join('');
        }
    } catch (err) {
        console.error("Error en loadRoles:", err);
    }
};

const loadUsers = async () => {
    try {
        console.log("Cargando usuarios...");
        const res = await fetch('/api/admin/usuarios', {
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            throw new Error(`Error HTTP: ${res.status}`);
        }

        const users = await res.json();
        console.log("Usuarios cargados:", users);
        renderTable(users);
    } catch (err) {
        console.error("Error en loadUsers:", err);
        const tbody = document.getElementById('usersTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr><td colspan="6" style="text-align: center; color: red;">
                    Error al cargar usuarios: ${err.message}
                </td></tr>
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
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="btn-action" onclick="window.editUser('${user.id_usuario}')" title="Editar">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-action ${user.activo ? 'btn-toggle-off' : 'btn-toggle-on'}" 
                            onclick="window.toggleUser('${user.id_usuario}', ${user.activo})" 
                            title="${user.activo ? 'Desactivar' : 'Activar'}">
                        <i class="fa-solid ${user.activo ? 'fa-user-slash' : 'fa-user-check'}"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Expose functions to window for onclick handlers
    window.editUser = (id) => {
        const user = users.find(u => u.id_usuario == id);
        if (user) openModal(user);
    };

    window.toggleUser = async (id, currentStatus) => {
        const confirmed = await showConfirm({
            title: currentStatus ? 'Desactivar Usuario' : 'Activar Usuario',
            message: `¿Estás seguro de que deseas ${currentStatus ? 'desactivar' : 'activar'} este usuario?`,
            type: currentStatus ? 'danger' : 'success'
        });

        if (!confirmed) return;

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

    modal.classList.add('active');
    form.reset();

    if (user) {
        title.textContent = 'Editar Usuario';
        document.getElementById('userId').value = user.id_usuario;
        document.getElementById('nombres_apellidos').value = user.nombres_apellidos;
        document.getElementById('username').value = user.username;
        document.getElementById('email').value = user.email;
        document.getElementById('rol_id').value = user.rol_id;

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
    document.getElementById('userModal').classList.remove('active');
};

const handleFormSubmit = async (e) => {
    e.preventDefault();

    const userId = document.getElementById('userId').value;
    const isEdit = !!userId;

    const rolIdVal = document.getElementById('rol_id').value;
    if (!rolIdVal) {
        alert("Por favor seleccione un rol");
        return;
    }

    const formData = {
        nombres_apellidos: document.getElementById('nombres_apellidos').value,
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        rol_id: parseInt(rolIdVal),
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

const handleLogout = async () => {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: getAuthHeaders()
        });
    } catch (error) {
        console.error("Logout error", error);
    } finally {
        clearAuthSession();
        navigateTo('/');
    }
};
