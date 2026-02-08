import { Router } from "express";
import { 
  getDashboardStats,
  getRegistrosHistory,
  getUsers,
  toggleUserStatus
} from "../controllers/adminController.js";
import { authenticate, authorize } from "../middlewares/authMiddleware.js";

const router = Router();

// Todas las rutas de admin requieren autenticación y rol ADMINISTRADOR
router.use(authenticate);
router.use(authorize("ADMINISTRADOR"));

// Dashboard estadísticas
router.get("/stats", getDashboardStats);

// Historial de registros
router.get("/registros", getRegistrosHistory);

// Gestión de usuarios
router.get("/usuarios", getUsers);
router.patch("/usuarios/:id/toggle", toggleUserStatus);

export default router;
