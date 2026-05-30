

# PARKPLATZ
## Sistema de Gestión de Estacionamiento

Sistema web para la gestión de estacionamientos que permite registrar entradas y salidas de vehículos, administrar espacios disponibles y configurar tarifas según el tipo de vehículo. Incluye un panel administrativo con estadísticas en tiempo real, historial de movimientos y reportes mensuales.

## Características

### Rol Operario
* Registro de entrada de vehículos (placa, tipo de vehículo y espacio asignado).<br>
* Registro de salida con cálculo automático de tarifa.<br>
* Vista previa del costo antes de confirmar la salida.<br>
* Consulta del estado de ocupación y cupos disponibles en tiempo real.<br>

### Rol Administradores
* Dashboard con estadísticas diarias.<br>
* Historial completo de registros con filtros.<br>
* Reportes mensuales de ingresos.<br>
* Gestión de espacios de estacionamiento.<br>
* Administración de tarifas por tipo de vehículo.<br>
* Administración de usuarios.<br>
* Activación, desactivación y restablecimiento de contraseñas.<br>

## Tecnologías Utilizadas

| Capa | Tecnología |
|---|---|
| **Frontend** | HTML5 · CSS3 · JavaScript Vanilla + Vite |
| **Backend** | Node.js + Express.js (ESModules) |
| **Base de datos** | Supabase (PostgreSQL) |
| **Autenticación** | JWT + bcrypt |
| **Despliegue** | Vercel (Web Service único) |

## Arquitectura
```bash
Usuario
   │
   ▼ 
Frontend (Vite + JavaScript)
   │
   ▼
API REST (Node.js + Express)
   │
   ▼
Supabase PostgreSQL
```

## Requisitos
* Node.js 22 o superior
* Base de datos en Supabase
* npm

## Instalación

### 1. Clonar el repositorio
```bash
git clone https://github.com/emilymontec/PARKPLATZ.git
cd PARKPLATZ
```

### 2. Configurar variables de entorno
Crea el archivo `backend/.env`, con las siguientes variables:

```bash
SUPABASE_URL=https://id.supabase.co 
SUPABASE_KEY=public_api_key
SUPABASE_SERVICE_ROLE_KEY=private_api_key
SUPABASE_PSWD=password_db
JWT_SECRET=jwt_example
DEFAULT_RESET_PASSWORD=P123
```

### 3. Configurar la base de datos
En el **SQL Editor** de tu proyecto en Supabase, ejecuta el archivo `backend/schema.sql`.

### 4. Iniciar en desarrollo
```bash
#Instalar dependencias de la raíz
npm install

#Iniciar backend y frontend simultáneamente
npm run dev
```
**La aplicación estará disponible en:** http://localhost:4000

## Estructura del Proyecto

```
PARKPLATZ/
├── package.json              # Scripts globales (dev, build)
│
├── frontend/
│   ├── src/                  # Código fuente del frontend
│   ├── public/               # Archivos estáticos
│   ├── dist/                 # Build de producción (generado)
│   ├── index.html
│   └── vite.config.js
│
└── backend/
    ├── .env                  # Variables de entorno (NO subir a GitHub)
    ├── schema.sql            # Esquema de base de datos
    ├── package.json
    └── src/
        ├── index.js          # Punto de entrada del servidor
        ├── config/
        │   └── db.js         # Configuración de Supabase
        ├── routes/
        │   ├── authRoutes.js
        │   ├── registroRoutes.js
        │   └── adminRoutes.js
        ├── controllers/
        ├── middlewares/
        ├── services/
        └── utils/
```

## APIs

### Autenticación (`/api/auth`)
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| POST | `/api/auth/login` | Iniciar sesión | Público |

### Registros (`/api/registros`)
| Método | Ruta | Descripción | Acceso |
|---|---|---|---|
| GET | `/api/registros/cupos` | Estado de cupos | Operario+ |
| GET | `/api/registros/activos` | Vehículos en el parqueadero | Operario+ |
| GET | `/api/registros/tipos-vehiculo` | Lista de tipos | Operario+ |
| GET | `/api/registros/preview-salida` | Previsualizar costo de salida | Operario+ |
| POST | `/api/registros/entrada` | Registrar entrada | Operario+ |
| POST | `/api/registros/salida` | Registrar salida | Operario+ |

### Administración (`/api/admin`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/stats` | Estadísticas del dashboard |
| GET | `/api/admin/reporte` | Reporte mensual |
| GET | `/api/admin/registros` | Historial de registros |
| GET | `/api/admin/espacios` | Estado de espacios |
| POST | `/api/admin/espacios/reset` | Resetear espacios a disponible |
| GET | `/api/admin/usuarios` | Listar usuarios |
| POST | `/api/admin/usuarios` | Crear usuario |
| PUT | `/api/admin/usuarios/:id` | Editar usuario |
| PATCH | `/api/admin/usuarios/:id/toggle` | Activar/desactivar usuario |
| PATCH | `/api/admin/usuarios/:id/reset-password` | Resetear contraseña |
| GET | `/api/admin/tarifas` | Listar tarifas |
| POST | `/api/admin/tarifas` | Crear tarifa |
| PUT | `/api/admin/tarifas/:id` | Editar tarifa |
| PATCH | `/api/admin/tarifas/:id/toggle` | Activar/desactivar tarifa |

## Seguridad
Autenticación basada en JWT.<br>
Contraseñas cifradas mediante bcrypt.<br>
Control de acceso basado en roles.<br>
Variables sensibles protegidas mediante archivos .env.<br>
Separación de privilegios mediante cuentas operativas y administrativas.<br>

## Contribuciones
Haz un fork. <br>
Crea una rama nueva para tu funcionalidad:
```bash
git checkout -b feature/nueva-funcion
```
Realiza tus cambios y haz commit. <br>
Abre un Pull Request.

## Licencia
Este proyecto está bajo la **Licencia MIT**.<br>
Consulta el archivo [LICENSE](./LICENSE) para más información.

## Equipo de Desarrollo

| Integrante | Rol |	GitHub 
|---|---|---|
| Jemima Cerpa | Desarrollo Frontend | [jemcu](https://github.com/jemcu) |
| Jailiss Gómez	| Diseño UX/UI | [jailisita](https://github.com/jailisita) |
| Melany Tesillo | Desarrollo Frontend | [mptse](https://github.com/mptse) |
| Emily Monterrosa | Desarrollo Backend | [emilymontec](https://github.com/emilymontec) |
