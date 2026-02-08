import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "tu-clave-secreta-muy-segura-cambiar-en-produccion";
const JWT_EXPIRATION = "24h";

/**
 * Generar JWT token
 */
export const generateToken = (userData) => {
  const payload = {
    id: userData.id,
    username: userData.username,
    rol: userData.rol,
    email: userData.email,
    nombres_apellidos: userData.nombres_apellidos
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
};

/**
 * Verificar y decodificar JWT token
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

/**
 * Extraer token del header Authorization
 */
export const getTokenFromHeader = (authHeader) => {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
};
