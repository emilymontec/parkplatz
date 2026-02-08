import { verifyToken, getTokenFromHeader } from "../services/authService.js";

/**
 * Middleware de autenticación
 * Verifica que el usuario tenga un JWT válido
 */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = getTokenFromHeader(authHeader);

  if (!token) {
    return res.status(401).json({ 
      error: "Token de autenticación requerido",
      code: "NO_TOKEN"
    });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ 
      error: "Token inválido o expirado",
      code: "INVALID_TOKEN"
    });
  }

  // Guardar usuario decodificado en req para usar en controladores
  req.user = decoded;
  next();
};

/**
 * Middleware de autorización por rol
 * Verifica que el usuario tenga el rol requerido
 */
export const authorize = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: "Usuario no autenticado",
        code: "NOT_AUTHENTICATED"
      });
    }

    const userRole = req.user.rol?.toUpperCase();
    const allowedRoles = Array.isArray(requiredRoles) 
      ? requiredRoles.map(r => r.toUpperCase()) 
      : [requiredRoles.toUpperCase()];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: `Acceso denegado. Se requiere role: ${allowedRoles.join(", ")}`,
        code: "INSUFFICIENT_ROLE",
        userRole: userRole,
        requiredRoles: allowedRoles
      });
    }

    next();
  };
};
