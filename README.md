<div align="center">

# PARKPLATZ

<p align="center">
  <strong>Parking Lot Monitoring and Management System with Vehicle Flow Control Infrastructure</strong>
</p>

<sub> Created by: </sub>
<p align="center">
  <a href="https://github.com/jailisita">Jailiss Gómez</a> ·
  <a href="https://github.com/jemcu">Gemima Cerpa</a> ·
  <a href="https://github.com/mptse">Melany Tesillo</a> ·
  <a href="https://github.com/emilymontec">Emily Monterrosa</a>
</p>

<img src="https://img.shields.io/badge/backend-node.js-fb7d03?style=flat-square">
<img src="https://img.shields.io/badge/frontend-html5/css3-fb7d03?style=flat-square">
<img src="https://img.shields.io/badge/database-supabase-fb7d03?style=flat-square">

</div>

---

We are a student group focused on exploring emerging technologies and developing innovative solutions.

As part of our learning and experimentation process, we have created a web-based parking management system that allows users to record vehicle entries and exits, manage parking space availability, and set rates based on vehicle type.

| | |
|---|---|
| **Administrative Dashboard** | real-time statistics, movement history, and monthly report generation. |
| **Operator Dashboard** | vehicle entry and exit registration, real-time check of occupancy status and available spaces. |
| **Rates** | rate management by the administrator, rate calculation, and payment processing. |
| **User Profiles** | activating and deactivating profiles, and resetting passwords. |

You can do all of this here.

---

## Functions such as...

<table>
<tr>
<td width="50%" valign="top">

<h3>Administrator</h3>

You can view a dashboard with daily statistics, access the history of vehicle entry and exit records, generate monthly reports exportable as PDFs, manage parking spaces by vehicle type, manage rates by vehicle type and time period (day, hour, time slot), manage users, activate/deactivate accounts, and reset passwords.

</td>
<td width="50%" valign="top">

<h3>Operator</h3>

Record vehicle entry (license plate, vehicle type, and assigned space) and issue a registration ticket; record exit with automatic fee calculation and cost preview (receipt). Check available and occupied spaces in real time.

</td>
</tr>
</table>

---

## Technologies Used

<img src="https://img.shields.io/badge/Node.js-+22-fb7d03?style=flat-square"> <img src="https://img.shields.io/badge/Express.js-+5.2-fb7d03?style=flat-square">
<img src="https://img.shields.io/badge/HTML-5-fb7d03?style=flat-square"> <img src="https://img.shields.io/badge/CSS-3-fb7d03?style=flat-square">
<img src="https://img.shields.io/badge/Vite-+5.4-fb7d03?style=flat-square"> <img src="https://img.shields.io/badge/Supabase-PostgreSQL-fb7d03?style=flat-square">
<img src="https://img.shields.io/badge/Deployment-Vercel-fb7d03?style=flat-square">

---

## System Architecture
```
parkplatz → Users → Frontend → Backend → Database
```

---

## Installation

```bash
git clone https://github.com/emilymontec/parkplatz.git; cd parkplatz
```

Clone the repository on your computer and navigate to the project directory.

### Set environment variables

Create a `.env` file in the directory `backend` of the project and add the following variables:

```bash
# .env
SUPABASE_URL=SUPABASE_URL
SUPABASE_KEY=SUPABASE_KEY
SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PSWD=SUPABASE_PSWD
JWT_SECRET=JWT_SECRET_KEY
DEFAULT_RESET_PASSWORD=DEFAULT_RESET_PASSWORD
```

### Configure the database

In the SQL Editor of your Supabase project, run the file `backend/schema.sql`.

### Execute

```bash
npm install
npm start
```

> The app will be available at: http://localhost:4000

---

## File Structure
```bash
   Parkplatz
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

---

## License

This project is licensed under the **[MIT License](./LICENSE)**. See the file for more information.

---

<p align="center">
  <strong>The system is not deployed.</strong>
</p>
