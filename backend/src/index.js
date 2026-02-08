import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import { supabase } from "./config/db.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, "../../frontend")));

app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/index.html"));
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Nombre de usuario y contraseña son requeridos" });
  }

  try {
    const { data: users, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("username", username)
      .limit(1);

    if (error) {
      console.error("Login error:", error);
      return res.status(500).json({ error: "Error en el servidor" });
    }

    if (!users || users.length === 0) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const user = users[0];
    
    // Check if user is active
    if (!user.activo) {
        return res.status(403).json({ error: "Usuario deshabilitado" });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // Return user info excluding sensitive data
    const { password_hash, ...userInfo } = user;
    res.json({ message: "Acceso permitido", user: userInfo });

  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

app.listen(4000, () => {
  console.log("Server → http://localhost:4000");
});