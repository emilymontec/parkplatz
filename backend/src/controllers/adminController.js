import { supabase } from "../config/db.js";

/**
 * Obtener estadísticas del dashboard
 */
export const getDashboardStats = async (req, res) => {
  try {
    // 1. Ocupación actual
    const { count: ocupacionActual, error: errorOcupacion } = await supabase
      .from("registros")
      .select("*", { count: "exact", head: true })
      .eq("estado", "EN_CURSO");

    if (errorOcupacion) throw errorOcupacion;

    // 2. Ingresos de hoy
    const today = new Date().toISOString().split("T")[0];
    const { data: ingresosData, error: errorIngresos } = await supabase
      .from("registros")
      .select("valor_calculado")
      .eq("estado", "FINALIZADO")
      .gte("salida", `${today}T00:00:00`)
      .lte("salida", `${today}T23:59:59`);

    if (errorIngresos) throw errorIngresos;
    
    const ingresosHoy = ingresosData.reduce((sum, reg) => sum + (reg.valor_calculado || 0), 0);

    // 3. Vehículos hoy
    const { count: vehiculosHoy, error: errorVehiculos } = await supabase
      .from("registros")
      .select("*", { count: "exact", head: true })
      .gte("entrada", `${today}T00:00:00`)
      .lte("entrada", `${today}T23:59:59`);

    if (errorVehiculos) throw errorVehiculos;

    // 4. Espacios disponibles (Total aproximado 45: 30 autos + 15 motos)
    // Esto podría refinarse si hubiera una tabla de configuración de espacios
    const espaciosDisponibles = 45 - (ocupacionActual || 0);

    res.json({
      ocupacionActual: ocupacionActual || 0,
      espaciosDisponibles: espaciosDisponibles > 0 ? espaciosDisponibles : 0,
      ingresosHoy,
      vehiculosHoy: vehiculosHoy || 0
    });

  } catch (err) {
    console.error("Error getting stats:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Obtener historial de registros reciente
 */
export const getRegistrosHistory = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("registros")
      .select(`
        id_registro,
        placa,
        entrada,
        salida,
        estado,
        valor_calculado,
        tipos_vehiculo(nombre)
      `)
      .order("entrada", { ascending: false })
      .limit(10);

    if (error) throw error;
    
    // Mapear respuesta para mantener compatibilidad con frontend si usa nombres viejos
    // O mejor, el frontend debería adaptarse. Por ahora mapearé para asegurar.
    const mappedData = data.map(reg => ({
        ...reg,
        hora_entrada: reg.entrada,
        hora_salida: reg.salida,
        costo_total: reg.valor_calculado
    }));

    res.json(mappedData);
  } catch (err) {
    console.error("Error getting history:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Obtener todos los roles
 */
export const getRoles = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("roles")
      .select("*")
      .order("id_roles", { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Error getting roles:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Obtener listado de tipos de vehículo
 */
export const getTiposVehiculo = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tipos_vehiculo")
      .select("*")
      .order("nombre", { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Error getting vehicle types:", err);
    res.status(500).json({
      error: err.message,
      code: "DB_ERROR"
    });
  }
};

/**
 * Obtener usuarios
 */
export const getUsers = async (req, res) => {
  try {
    // Importante: traer rol_id para el frontend edit modal
    const { data, error } = await supabase
      .from("usuarios")
      .select(`
        id_usuario,
        username,
        email,
        nombres_apellidos,
        activo,
        rol_id,
        roles (
          nombre
        )
      `)
      .order("fecha_creacion", { ascending: false });

    if (error) throw error;

    // Mapear para facilitar uso en frontend
    const users = data.map(u => ({
      ...u,
      rol: u.roles?.nombre || 'Sin Rol'
    }));

    res.json(users);
  } catch (err) {
    console.error("Error getting users:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Crear usuario (Sincronizado con Supabase Auth)
 */
export const createUser = async (req, res) => {
  const { username, email, password, nombres_apellidos, rol_id } = req.body;

  if (!email || !password || !username || !rol_id) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  try {
    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, nombres_apellidos }
    });

    if (authError) throw authError;

    // 2. Crear usuario en tabla local 'usuarios'
    const { data: existingUser } = await supabase
      .from("usuarios")
      .select("id_usuario")
      .eq("id_usuario", authData.user.id)
      .single();

    if (!existingUser) {
      const { error: dbError } = await supabase
        .from("usuarios")
        .insert([{
          id_usuario: authData.user.id,
          username,
          email,
          nombres_apellidos,
          rol_id,
          activo: true
        }]);

      if (dbError) {
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw dbError;
      }
    } else {
        const { error: updateError } = await supabase
            .from("usuarios")
            .update({
                username,
                nombres_apellidos,
                rol_id,
                activo: true
            })
            .eq("id_usuario", authData.user.id);
        
        if (updateError) throw updateError;
    }

    res.status(201).json({ message: "Usuario creado exitosamente", user: authData.user });

  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Actualizar usuario
 */
export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { nombres_apellidos, username, email, rol_id, password } = req.body;

  try {
    // 1. Actualizar tabla local
    const { error: dbError } = await supabase
      .from("usuarios")
      .update({
        nombres_apellidos,
        username,
        rol_id
      })
      .eq("id_usuario", id);

    if (dbError) throw dbError;

    // 2. Si hay password, actualizar en Auth
    if (password && password.trim() !== "") {
      const { error: authError } = await supabase.auth.admin.updateUserById(
        id,
        { password: password }
      );
      if (authError) throw authError;
    }

    res.json({ message: "Usuario actualizado correctamente" });

  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Cambiar estado (Activar/Desactivar)
 */
export const toggleUserStatus = async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body; // boolean

  try {
    // 1. Actualizar BD local
    const { error: dbError } = await supabase
      .from("usuarios")
      .update({ activo })
      .eq("id_usuario", id);

    if (dbError) throw dbError;

    // 2. Bloquear/Desbloquear en Auth (ban)
    if (activo === false) {
       await supabase.auth.admin.updateUserById(id, { ban_duration: "876000h" }); // ~100 años
    } else {
       await supabase.auth.admin.updateUserById(id, { ban_duration: "0" }); // remove ban
    }

    res.json({ message: `Usuario ${activo ? 'activado' : 'desactivado'} correctamente` });

  } catch (err) {
    console.error("Error toggling user status:", err);
    res.status(500).json({ error: err.message });
  }
};
