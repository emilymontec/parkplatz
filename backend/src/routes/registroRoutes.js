import { Router } from "express";
import { 
  getActiveVehicles, 
  registerEntry, 
  registerExit,
  previewExit
} from "../controllers/registroController.js";
import { getTiposVehiculo } from "../controllers/tarifaController.js";
import { authenticate, authorize } from "../middlewares/authMiddleware.js";

const router = Router();

// Rutas accesibles para OPERARIO y ADMINISTRADOR
router.use(authenticate);
router.use(authorize(["OPERARIO", "ADMINISTRADOR"]));

// Obtener tipos de vehículo (Necesario para el select de entrada)
router.get("/tipos-vehiculo", getTiposVehiculo);

// Obtener vehículos activos
router.get("/activos", getActiveVehicles);

// Previsualizar salida (Cálculo)
router.get("/preview-salida", previewExit);

// Registrar entrada
router.post("/entrada", registerEntry);

// Registrar salida
router.post("/salida", registerExit);

export default router;
