import { Router } from "express";
import { 
  getActiveVehicles, 
  registerEntry, 
  registerExit 
} from "../controllers/registroController.js";
import { authenticate, authorize } from "../middlewares/authMiddleware.js";

const router = Router();

// Todas las rutas de registros requieren autenticación y rol OPERARIO
router.use(authenticate);
router.use(authorize("OPERARIO"));

// Obtener vehículos activos
router.get("/activos", getActiveVehicles);

// Registrar entrada
router.post("/entrada", registerEntry);

// Registrar salida
router.post("/salida", registerExit);

export default router;
