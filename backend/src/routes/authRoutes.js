import { Router } from "express";
import { login, logout, verify, changePassword } from "../controllers/authController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = Router();

// Ruta pública: Login
router.post("/login", login);

// Rutas protegidas (requieren autenticación)
router.post("/logout", authenticate, logout);
router.get("/verify", authenticate, verify);
router.post("/change-password", authenticate, changePassword);

export default router;
