import { Router } from "express";
import { 
  getDashboardStats,
  getRegistrosHistory,
  getUsers,
  getRoles,
  createUser,
  updateUser,
  toggleUserStatus,
  getRegistrosDebug,
  getEspacios,
  resetEspacios,
  getMonthlyReport
} from "../controllers/adminController.js";
import {
  getTarifas,
  createTarifa,
  updateTarifa,
  toggleTarifaStatus,
  getTiposVehiculo
} from "../controllers/tarifaController.js";
import { authenticate, authorize } from "../middlewares/authMiddleware.js";

const router = Router();

// Todas las rutas de admin requieren autenticación y rol ADMINISTRADOR
router.use(authenticate);
router.use(authorize("ADMINISTRADOR"));

// Dashboard estadísticas
router.get("/stats", getDashboardStats);

// Reporte Mensual
router.get("/reporte", getMonthlyReport);

// DEBUG: Ver datos completos de registros de hoy
router.get("/debug/registros-hoy", getRegistrosDebug);

// Gestión de Espacios (Parking Spaces)
router.get("/espacios", getEspacios);
router.post("/espacios/reset", resetEspacios);

// Historial de registros
router.get("/registros", getRegistrosHistory);

// Gestión de usuarios
router.get("/roles", getRoles);
router.get("/usuarios", getUsers);
router.post("/usuarios", createUser);
router.put("/usuarios/:id", updateUser);
router.patch("/usuarios/:id/toggle", toggleUserStatus);

// Gestión de Tarifas
router.get("/tarifas", getTarifas);
router.post("/tarifas", createTarifa);
router.put("/tarifas/:id", updateTarifa);
router.patch("/tarifas/:id/toggle", toggleTarifaStatus);
router.get("/tipos-vehiculo", getTiposVehiculo);

export default router;
