import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/authRoutes.js";
import registroRoutes from "./routes/registroRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, "../../frontend")));

// Servir index.html para SPA
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/index.html"));
});

// ========== RUTAS DE API ==========

// Rutas de autenticación (login pública, otras protegidas)
app.use("/api/auth", authRoutes);

// Rutas de registros de vehículos (protegidas: OPERARIO)
app.use("/api/registros", registroRoutes);

// Rutas de administración (protegidas: ADMINISTRADOR)
app.use("/api/admin", adminRoutes);

// ========== SPA FALLBACK ==========

// Middleware para servir SPA en rutas no encontradas
app.use((req, res) => {
  // Si es una ruta de API no encontrada
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      error: "Ruta no encontrada",
      path: req.path,
      code: "NOT_FOUND"
    });
  }
  
  // Servir index.html para rutas del frontend (SPA routing)
  const indexPath = path.join(__dirname, "../../frontend/index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("Error sirviendo index.html:", err);
      res.status(500).json({
        error: "Error interno del servidor",
        code: "SERVER_ERROR"
      });
    }
  });
});

// ========== INICIAR SERVIDOR ==========

app.listen(4000, () => {
  console.log(`Server running at http://localhost:4000`);
});