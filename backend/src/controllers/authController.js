import bcrypt from "bcrypt";
import { supabase } from "../config/db.js";
import { generateToken } from "../services/authService.js";

/**
 * Login - Autenticar usuario y generar JWT
 */
export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ 
      error: "Nombre de usuario y contraseña son requeridos",
      code: "MISSING_CREDENTIALS"
    });
  }

  try {
    // Buscar usuario en base de datos con JOIN de rol
    const { data: users, error } = await supabase
      .from("usuarios")
      .select("*, roles(nombre)")
      .eq("username", username)
      .limit(1);

    if (error) {
      console.error("Login error:", error);
      return res.status(500).json({ 
        error: "Error en el servidor",
        code: "DB_ERROR"
      });
    }

    if (!users || users.length === 0) {
      return res.status(401).json({ 
        error: "Credenciales inválidas",
        code: "INVALID_CREDENTIALS"
      });
    }

    const user = users[0];

    // Verificar que el usuario esté activo
    if (!user.activo) {
      return res.status(403).json({ 
        error: "Usuario deshabilitado",
        code: "USER_DISABLED"
      });
    }

    // Verificar contraseña
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ 
        error: "Credenciales inválidas",
        code: "INVALID_CREDENTIALS"
      });
    }

    // Preparar datos del usuario para el token
    const tokenPayload = {
      id: user.id_usuario,
      username: user.username,
      rol: user.roles?.nombre || "OPERARIO", // Obtener nombre del rol
      email: user.email,
      nombres_apellidos: user.nombres_apellidos
    };

    // Generar JWT token
    const token = generateToken(tokenPayload);

    // Retornar usuario sin datos sensibles y token
    const { password_hash, rol_id, roles, ...userInfo } = user;
    res.json({ 
      message: "Autenticación exitosa",
      token,
      user: {
        ...userInfo,
        rol: tokenPayload.rol // Enviar nombre del rol
      }
    });

  } catch (err) {
    console.error("Unexpected error in login:", err);
    res.status(500).json({ 
      error: "Error en el servidor",
      code: "SERVER_ERROR"
    });
  }
};

/**
 * Logout - Limpiar sesión (función auxiliar que USA el frontend)
 * El backend no mantiene estado, pero esta ruta valida el token antes de desconectar
 */
export const logout = async (req, res) => {
  // El usuario existe en req.user (validado por middleware)
  res.json({ 
    message: "Sesión cerrada correctamente",
    user: req.user
  });
};

/**
 * Verify - Verificar que el token actual es válido
 * Útil para validaciones de sesión en el frontend
 */
export const verify = async (req, res) => {
  res.json({ 
    message: "Token válido",
    user: req.user
  });
};
