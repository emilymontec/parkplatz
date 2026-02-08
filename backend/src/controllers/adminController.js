import { supabase } from "../config/db.js";
import bcrypt from "bcrypt";

/**
 * Obtener estadísticas del dashboard
 * Ruta protegida: Solo ADMINISTRADOR
 */
export const getDashboardStats = async (req, res) => {
  try {
    // Obtener registros de hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayIso = today.toISOString();

    // Ingresos del día - registros finalizados hoy
    const { data: todayRegistros, error: regError } = await supabase
      .from("registros")
      .select("valor_calculado")
      .gte("entrada", todayIso)
      .eq("estado", "FINALIZADO");

    if (regError) throw regError;

    const income = todayRegistros?.reduce((sum, reg) => sum + (parseFloat(reg.valor_calculado) || 0), 0) || 0;

    // Vehículos activos (en curso)
    const { data: activeVehicles, error: activeError } = await supabase
      .from("registros")
      .select("id_registro")
      .eq("estado", "EN_CURSO");

    if (activeError) throw activeError;

    const active = activeVehicles?.length || 0;

    // Capacidad total (30 autos + 15 motos)
    const totalCapacity = 45;
    const occupancy = Math.round((active / totalCapacity) * 100);

    res.json({
      income,
      occupancy,
      active,
      totalCapacity,
      date: today.toISOString().split('T')[0]
    });

  } catch (err) {
    console.error("Error getting dashboard stats:", err);
    res.status(500).json({ 
      error: err.message,
      code: "DB_ERROR"
    });
  }
};

/**
 * Obtener historial de registros paginado
 * Ruta protegida: Solo ADMINISTRADOR
 */
export const getRegistrosHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Obtener total
    const { count, error: countError } = await supabase
      .from("registros")
      .select("*", { count: "exact", head: true });

    if (countError) throw countError;

    // Obtener registros paginados con información relacionada
    const { data, error } = await supabase
      .from("registros")
      .select(`
        id_registro,
        placa,
        vehiculo_id,
        tipos_vehiculo(nombre),
        entrada,
        salida,
        total_minutos,
        valor_calculado,
        estado,
        usuario_entrada,
        usuario_salida
      `)
      .order("entrada", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      data,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (err) {
    console.error("Error getting registros history:", err);
    res.status(500).json({ 
      error: err.message,
      code: "DB_ERROR"
    });
  }
};

/**
 * Obtener listado de roles
 * Ruta protegida: Solo ADMINISTRADOR
 */
export const getRoles = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("roles")
      .select("*")
      .order("nombre", { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Error getting roles:", err);
    res.status(500).json({
      error: err.message,
      code: "DB_ERROR"
    });
  }
};

/**
 * Obtener listado de usuarios (gestión)
 * Ruta protegida: Solo ADMINISTRADOR
 */
export const getUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select(`
        id_usuario,
        username,
        email,
        rol_id,
        roles(nombre),
        nombres_apellidos,
        activo,
        fecha_creacion
      `)
      .order("fecha_creacion", { ascending: false });

    if (error) throw error;

    // Transformar datos para mejor legibilidad
    const usuarios = data.map(user => ({
      id_usuario: user.id_usuario,
      username: user.username,
      email: user.email,
      rol: user.roles?.nombre || "DESCONOCIDO",
      rol_id: user.rol_id,
      nombres_apellidos: user.nombres_apellidos,
      activo: user.activo,
      fecha_creacion: user.fecha_creacion
    }));

    res.json(usuarios);

  } catch (err) {
    console.error("Error getting users:", err);
    res.status(500).json({ 
      error: err.message,
      code: "DB_ERROR"
    });
  }
};

/**
 * Crear nuevo usuario
 * Ruta protegida: Solo ADMINISTRADOR
 */
export const createUser = async (req, res) => {
  const { username, password, email, rol_id, nombres_apellidos } = req.body;

  if (!username || !password || !email || !rol_id || !nombres_apellidos) {
    return res.status(400).json({
      error: "Todos los campos son requeridos",
      code: "MISSING_FIELDS"
    });
  }

  try {
    // Verificar si el usuario ya existe
    const { data: existingUser, error: checkError } = await supabase
      .from("usuarios")
      .select("id_usuario")
      .or(`username.eq.${username},email.eq.${email}`)
      .single();

    if (existingUser) {
      return res.status(409).json({
        error: "El usuario o email ya existe",
        code: "USER_EXISTS"
      });
    }

    // Hash de contraseña
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insertar usuario
    const { data, error } = await supabase
      .from("usuarios")
      .insert([{
        username,
        password_hash,
        email,
        rol_id,
        nombres_apellidos,
        activo: true // Por defecto activo
      }])
      .select(`
        id_usuario,
        username,
        email,
        rol_id,
        nombres_apellidos,
        activo,
        fecha_creacion
      `)
      .single();

    if (error) throw error;

    res.status(201).json({
      message: "Usuario creado exitosamente",
      user: data
    });

  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({
      error: err.message,
      code: "DB_ERROR"
    });
  }
};

/**
 * Actualizar usuario (Asignar rol, editar datos)
 * Ruta protegida: Solo ADMINISTRADOR
 */
export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { username, email, rol_id, nombres_apellidos, password } = req.body;

  if (!id) {
    return res.status(400).json({
      error: "ID de usuario requerido",
      code: "MISSING_ID"
    });
  }

  try {
    // Validar que el rol existe si se está actualizando
    if (rol_id) {
      const { data: roleExists, error: roleError } = await supabase
        .from("roles")
        .select("id_rol")
        .eq("id_rol", rol_id)
        .single();

      if (roleError || !roleExists) {
        return res.status(400).json({
          error: "El rol seleccionado no es válido",
          code: "INVALID_ROLE"
        });
      }
    }

    const updates = {};
    if (username) updates.username = username;
    if (email) updates.email = email;
    if (rol_id) updates.rol_id = rol_id;
    if (nombres_apellidos) updates.nombres_apellidos = nombres_apellidos;

    // Si se proporciona contraseña, hashearla
    if (password) {
      const saltRounds = 10;
      updates.password_hash = await bcrypt.hash(password, saltRounds);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "No hay datos para actualizar",
        code: "NO_DATA"
      });
    }

    const { data, error } = await supabase
      .from("usuarios")
      .update(updates)
      .eq("id_usuario", id)
      .select(`
        id_usuario,
        username,
        email,
        rol_id,
        nombres_apellidos,
        activo
      `)
      .single();

    if (error) throw error;

    res.json({
      message: "Usuario actualizado exitosamente",
      user: data
    });

  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({
      error: err.message,
      code: "DB_ERROR"
    });
  }
};

/**
 * Desactivar/activar usuario
 * Ruta protegida: Solo ADMINISTRADOR
 */
export const toggleUserStatus = async (req, res) => {
  const { userId, activo } = req.body;
  // Support both body param and URL param for consistency if needed, 
  // but sticking to existing pattern for now.
  // Note: Route uses /:id/toggle so usually we use req.params.id too,
  // but the existing code used req.body.userId. 
  // I will make it flexible to support req.params.id if userId is missing.
  
  const targetId = userId || req.params.id;

  if (!targetId || typeof activo !== 'boolean') {
    return res.status(400).json({ 
      error: "userId (o param id) y activo son requeridos",
      code: "MISSING_FIELDS"
    });
  }

  try {
    const { data, error } = await supabase
      .from("usuarios")
      .update({ activo })
      .eq("id_usuario", targetId)
      .select(`
        id_usuario,
        username,
        email,
        rol_id,
        roles(nombre),
        nombres_apellidos,
        activo
      `)
      .single();

    if (error) throw error;

    const userInfo = {
      id_usuario: data.id_usuario,
      username: data.username,
      email: data.email,
      rol: data.roles?.nombre,
      nombres_apellidos: data.nombres_apellidos,
      activo: data.activo
    };

    res.json({
      message: `Usuario ${activo ? 'activado' : 'desactivado'}`,
      user: userInfo
    });

  } catch (err) {
    console.error("Error toggling user status:", err);
    res.status(500).json({ 
      error: err.message,
      code: "DB_ERROR"
    });
  }
};
