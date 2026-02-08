import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { supabase } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import registroRoutes from "./routes/registroRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { getTimezoneInfo, formatLocalDate, formatLocalTime, formatLocalDateOnly } from "./utils/dateUtils.js";

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
// ========== INICIALIZACIÓN DEL SISTEMA ==========

const initializeSystem = async () => {
  // console.log("Starting system initialization...");
  try {
    // 1. Roles
    const { data: roles } = await supabase.from("roles").select("*");
    if (!roles || roles.length === 0) {
      // console.log("Creating default roles...");
      await supabase.from("roles").insert([
        { id_roles: 1, nombre: "ADMINISTRADOR" },
        { id_roles: 2, nombre: "OPERARIO" }
      ]);
    }

    // 2. Auth Check (Usuarios)
    const { error: usersError } = await supabase.from("usuarios").select("count", { count: "exact", head: true });
    if (usersError) throw new Error(`Auth check failed: ${usersError.message}`);

    // 3. Tarifas Check
    const { count: tarifasCount } = await supabase.from("tarifas").select("*", { count: "exact", head: true }).eq("activo", true);
    if (tarifasCount === 0) {
        // console.warn("WARNING: No active tariffs.");
    }

    // 4. Espacios Check
    const { count: espaciosCount } = await supabase.from("espacios").select("*", { count: "exact", head: true });
    if (espaciosCount === 0) {
        // console.log("Creating default spaces...");
        const spaces = [];
        // 30 Autos (Tipo 1)
        for (let i = 1; i <= 30; i++) spaces.push({ codigo: `A-${i}`, espacio_id: 1, disponible: true });
        // 15 Motos (Tipo 3)
        for (let i = 1; i <= 15; i++) spaces.push({ codigo: `M-${i}`, espacio_id: 3, disponible: true });
        
        await supabase.from("espacios").insert(spaces);
    }

    // 5. Admin Check
    const { data: admins } = await supabase.from("usuarios").select("id_usuario").eq("rol_id", 1).limit(1);
    if (!admins || admins.length === 0) {
        // console.log("Creating default admin...");
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("admin123", salt);
        const adminId = crypto.randomUUID();
        
        await supabase.from("usuarios").insert([{
            id_usuario: adminId,
            username: "admin",
            password_hash: hashedPassword,
            email: "admin@parkplatz.com",
            nombres_apellidos: "Administrador Sistema",
            rol_id: 1,
            activo: true
        }]);
    }
  } catch (err) {
    console.error("System initialization failed:", err.message);
  }
};

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

initializeSystem().then(() => {
  app.listen(4000, () => {
    console.log(`Server running at http://localhost:4000`);
  });
});
