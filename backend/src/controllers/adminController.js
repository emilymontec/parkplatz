import { supabase } from "../config/db.js";
import { getTodayStartUTC, getTodayEndUTC, formatLocalDate } from "../utils/dateUtils.js";

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

    // 2. Ingresos/Ganancias de hoy (America/Bogota - Colombia)
    const startOfDay = getTodayStartUTC();
    const endOfDay = getTodayEndUTC();

    const { data: ingresosData, error: errorIngresos } = await supabase
      .from("registros")
      .select(`
        id_registro,
        valor_calculado, 
        tarifa_id,
        tarifas!left(id_tarifa, nombre, tipo_cobro, valor)
      `)
      .eq("estado", "FINALIZADO")
      .gte("salida", startOfDay)
      .lte("salida", endOfDay);

    if (errorIngresos) throw errorIngresos;
    
    // Filtrar valores negativos históricos en la suma para evitar montos < 0 en el dashboard
    const gananciasTotal = (ingresosData || []).reduce((sum, reg) => {
        const valor = Number(reg.valor_calculado) || 0;
        return sum + (valor > 0 ? valor : 0);
    }, 0);

    // 2.1 Obtener detalle de ganancias por tarifa (para desglose visual)
    const { data: detalleData, error: errorDetalle } = await supabase
        .from("registros")
        .select(`
            valor_calculado,
            tarifas (
                nombre,
                tipo_cobro,
                valor
            )
        `)
        .eq("estado", "FINALIZADO")
        .gte("salida", startOfDay)
        .lte("salida", endOfDay)
        .not("tarifa_id", "is", null);

    let gananciasData = [];
    if (!errorDetalle && detalleData) {
        // Agrupar por nombre de tarifa
        const agrupado = {};
        detalleData.forEach(reg => {
            const tarifaNombre = reg.tarifas?.nombre || 'Tarifa Eliminada';
            if (!agrupado[tarifaNombre]) {
                agrupado[tarifaNombre] = {
                    nombre: tarifaNombre,
                    tipo_cobro: reg.tarifas?.tipo_cobro || 'N/A',
                    valor_tarifa: reg.tarifas?.valor || 0,
                    cantidad_registros: 0,
                    total_hoy: 0
                };
            }
            const valor = Number(reg.valor_calculado) || 0;
            if (valor > 0) {
                agrupado[tarifaNombre].total_hoy += valor;
                agrupado[tarifaNombre].cantidad_registros++;
            }
        });
        gananciasData = Object.values(agrupado).sort((a, b) => b.total_hoy - a.total_hoy);
    }

    // 3. Vehículos hoy
    const { count: vehiculosHoy, error: errorVehiculos } = await supabase
      .from("registros")
      .select("*", { count: "exact", head: true })
      .gte("entrada", startOfDay)
      .lte("entrada", endOfDay);

    if (errorVehiculos) throw errorVehiculos;

    // 4. Espacios disponibles (Total aproximado 45: 30 autos + 15 motos)
    // Esto podría refinarse si hubiera una tabla de configuración de espacios
    const espaciosDisponibles = 45 - (ocupacionActual || 0);

    res.json({
      ocupacionActual: ocupacionActual || 0,
      espaciosDisponibles: espaciosDisponibles > 0 ? espaciosDisponibles : 0,
      gananciasHoy: gananciasTotal, // Renombrado para coincidir con frontend
      gananciasDetalle: gananciasData,
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
        total_minutos,
        tipos_vehiculo!left(id_vehiculo, nombre),
        tarifas!left(nombre, tipo_cobro)
      `)
      .order("entrada", { ascending: false })
      .limit(10);

    if (error) throw error;
    
    // Mapear respuesta con información de tarifa incluida y validar números
    const mappedData = data.map(reg => {
        const valorCalculado = Number(reg.valor_calculado) || 0;
        const valorValido = (!isNaN(valorCalculado) && valorCalculado >= 0) ? valorCalculado : 0;
        
        return {
            ...reg,
            hora_entrada: reg.entrada,
            hora_entrada_formateada: formatLocalDate(reg.entrada),
            hora_salida: reg.salida,
            hora_salida_formateada: reg.salida ? formatLocalDate(reg.salida) : null,
            costo_total: valorValido,
            valor_calculado: valorValido,
            tipo_vehiculo: reg.tipos_vehiculo?.nombre || 'Desconocido',
            tarifa_nombre: reg.tarifas?.nombre || 'Sin tarifa'
        };
    });

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

  // Validación de formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Formato de email inválido" });
  }

  // Validación de longitud de contraseña
  if (password.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
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
      if (password.length < 6) {
        return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
      }
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

/**
 * GET all registros finalizados de hoy (DEBUG)
 * Muestra los detalles completos para verificar cálculos
 */
export const getRegistrosDebug = async (req, res) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const today = formatter.format(new Date());
    
    const startOfDay = `${today}T00:00:00-05:00`;
    const endOfDay = `${today}T23:59:59-05:00`;

    const { data, error } = await supabase
      .from("registros")
      .select(`
        id_registro,
        placa,
        entrada,
        salida,
        total_minutos,
        valor_calculado,
        tarifa_id,
        tipos_vehiculo!inner(nombre),
        tarifas!left(id_tarifa, nombre, tipo_cobro, valor)
      `)
      .eq("estado", "FINALIZADO")
      .gte("salida", startOfDay)
      .lte("salida", endOfDay)
      .order("salida", { ascending: false });

    if (error) throw error;

    res.json({
      fecha: today,
      total_registros: data?.length || 0,
      registros: data || []
    });

  } catch (err) {
    console.error("Error getting debug data:", err);
    res.status(500).json({ error: err.message });
  }
};
