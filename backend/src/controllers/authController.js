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
    // Buscar usuario en base de datos con JOIN de rol (por username o email)
    const { data: users, error } = await supabase
      .from("usuarios")
      .select("*, roles(nombre)")
      .or(`username.eq."${username}",email.eq."${username}"`)
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

    // Verificar si es la contraseña por defecto
    const defaultPassword = process.env.DEFAULT_RESET_PASSWORD;
    let mustChangePassword = false;

    if (defaultPassword) {
      mustChangePassword = await bcrypt.compare(defaultPassword, user.password_hash);
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
        rol: tokenPayload.rol, // Enviar nombre del rol
        mustChangePassword
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
 * Cambiar contraseña propia
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; // From middleware

    // Validar nueva contraseña
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres." });
    }

    const defaultPassword = process.env.DEFAULT_RESET_PASSWORD;
    if (defaultPassword && newPassword === defaultPassword) {
      return res.status(400).json({ error: "La nueva contraseña no puede ser igual a la predeterminada." });
    }

    // Obtener hash actual para verificar
    const { data: user } = await supabase
      .from("usuarios")
      .select("password_hash")
      .eq("id_usuario", userId)
      .single();

    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    // Verificar contraseña actual (seguridad extra)
    const validCurrent = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validCurrent) {
      return res.status(400).json({ error: "La contraseña actual es incorrecta." });
    }

    // Verificar que la nueva no sea igual a la actual
    const sameAsCurrent = await bcrypt.compare(newPassword, user.password_hash);
    if (sameAsCurrent) {
      return res.status(400).json({ error: "La nueva contraseña debe ser diferente a la actual." });
    }

    // Actualizar
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);

    const { error: updateError } = await supabase
      .from("usuarios")
      .update({ password_hash })
      .eq("id_usuario", userId);

    if (updateError) throw updateError;

    res.json({ message: "Contraseña actualizada correctamente." });

  } catch (err) {
    res.status(500).json({ error: err.message });
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
