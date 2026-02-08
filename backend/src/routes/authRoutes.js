import { Router } from "express";
import { login, logout, verify } from "../controllers/authController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = Router();

// Ruta pública: Login
router.post("/login", login);

// Rutas protegidas (requieren autenticación)
router.post("/logout", authenticate, logout);
router.get("/verify", authenticate, verify);

export default router;
