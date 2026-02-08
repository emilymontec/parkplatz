import { supabase } from "../config/db.js";

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

    // Capacidad total (ejemplo: 100 espacios)
    const totalCapacity = 100;
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
 * Desactivar/activar usuario
 * Ruta protegida: Solo ADMINISTRADOR
 */
export const toggleUserStatus = async (req, res) => {
  const { userId, activo } = req.body;

  if (!userId || typeof activo !== 'boolean') {
    return res.status(400).json({ 
      error: "userId y activo son requeridos",
      code: "MISSING_FIELDS"
    });
  }

  try {
    const { data, error } = await supabase
      .from("usuarios")
      .update({ activo })
      .eq("id_usuario", userId)
      .select(`
        id_usuario,
        username,
        email,
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
