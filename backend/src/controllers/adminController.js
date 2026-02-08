import { supabase } from "../config/db.js";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { getTodayStartUTC, getTodayEndUTC, formatLocalDate } from "../utils/dateUtils.js";

// Helper para validar UUID
const isUUID = (str) => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(str);
};

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
    return res.status(400).json({ error: "Faltan campos requeridos: email, password, username, rol_id" });
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
    let authUserId = null;
    let authUserCreated = false;

    // 1. Intentar crear en Supabase Auth (opcional - si falla, continuamos)
    try {
        console.log(`[CreateUser] Intentando crear usuario en Auth: ${email}`);
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { username, nombres_apellidos }
        });

        if (authError) {
          console.error(`[CreateUser] Error Auth:`, authError);
          throw authError;
        }
        authUserId = authData.user.id;
        authUserCreated = true;
        console.log(`[CreateUser] Usuario creado en Auth con ID: ${authUserId}`);
    } catch (authErr) {
        // Si el error es por falta de permisos o RLS, solo creamos en BD local
        if (
          authErr.message?.includes("Not enough permissions") ||
          authErr.message?.includes("row-level security") ||
          authErr.code === '42501' ||
          authErr.status === 403 ||
          authErr.message?.includes("not allowed")
        ) {
            console.warn(`[CreateUser] Auth bloqueado por RLS/permisos. Creando usuario SOLO en BD local.`);
        } else if (authErr.message?.includes("User already exists")) {
            console.warn(`[CreateUser] Usuario ya existe en Auth. Continuando con creación en BD local.`);
        } else {
            throw authErr;
        }
    }

    // Generar hash de contraseña para login local
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // 2. Crear usuario en tabla local 'usuarios' (sin especificar id_usuario - se genera automáticamente)
    console.log(`[CreateUser] Insertando en BD local`);
    
    const insertData = {
      username,
      email,
      nombres_apellidos,
      rol_id,
      activo: true,
      password_hash
    };
    
    // Si se creó en Auth, guardar el UUID
    if (authUserId) {
      insertData.id_usuario = authUserId;
    }
    // Si no, dejar que Supabase genere el ID automáticamente

    const { data, error: dbError } = await supabase
      .from("usuarios")
      .insert([insertData])
      .select()
      .single();

    if (dbError) {
      console.error("[CreateUser] Error en BD local:", dbError);
      
      // Si se creó en Auth pero falló en BD, intentar limpiar Auth
      if (authUserCreated && authUserId) {
        try {
          await supabase.auth.admin.deleteUser(authUserId);
          console.log(`[CreateUser] Usuario borrado de Auth por error en BD`);
        } catch (delErr) {
          console.warn(`[CreateUser] No se pudo borrar usuario de Auth:`, delErr.message);
        }
      }
      throw dbError;
    }

    console.log(`[CreateUser] Usuario creado exitosamente: ${username} (ID: ${data.id_usuario})`);
    
    res.status(201).json({ 
        message: authUserCreated ? "Usuario creado exitosamente" : "Usuario creado (Auth deshabilitado)", 
        user: { 
          id_usuario: data.id_usuario,
          id: data.id_usuario,
          email, 
          username,
          nombres_apellidos,
          rol_id,
          activo: true
        }
    });

  } catch (err) {
    console.error("[CreateUser] Error final:", err);
    res.status(500).json({ 
      error: err.message,
      hint: "Si el error es de permisos, verifica que SUPABASE_SERVICE_ROLE_KEY esté configurada en .env"
    });
  }
};

/**
 * Actualizar usuario
 */
export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { nombres_apellidos, username, email, rol_id, password } = req.body;

  if (!id) {
    return res.status(400).json({ error: "ID de usuario requerido" });
  }

  try {
    console.log(`[UpdateUser] Actualizando usuario ID: ${id}`);
    
    let updateData = {};
    
    if (nombres_apellidos) updateData.nombres_apellidos = nombres_apellidos;
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (rol_id) updateData.rol_id = rol_id;

    // Si hay password, actualizar hash en BD local
    if (password && password.trim() !== "") {
        if (password.length < 6) {
            return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
        }
        const salt = await bcrypt.genSalt(10);
        updateData.password_hash = await bcrypt.hash(password, salt);
        console.log(`[UpdateUser] Contraseña incluida en actualización`);
    }

    // 1. Actualizar tabla local
    console.log(`[UpdateUser] Datos a actualizar:`, { ...updateData, password_hash: updateData.password_hash ? '***' : undefined });
    
    const { data: updatedUser, error: dbError } = await supabase
      .from("usuarios")
      .update(updateData)
      .eq("id_usuario", id)
      .select()
      .single();

    if (dbError) {
      console.error("[UpdateUser] Error en BD:", dbError);
      throw dbError;
    }
    
    if (!updatedUser) {
        console.warn(`[UpdateUser] No se encontró usuario con ID ${id}`);
        return res.status(404).json({ error: "Usuario no encontrado" });
    }

    console.log("[UpdateUser] Usuario actualizado en BD local exitosamente");

    // 2. Si hay password y el ID es un UUID válido, actualizar en Auth
    if (password && password.trim() !== "" && isUUID(id)) {
      try {
          console.log(`[UpdateUser] Actualizando password en Auth`);
          const { error: authError } = await supabase.auth.admin.updateUserById(
            id,
            { password: password }
          );
          if (authError) {
              console.warn("[UpdateUser] Advertencia al actualizar Auth:", authError.message);
              // No es crítico si falla Auth, el login local funciona con bcrypt
          } else {
              console.log(`[UpdateUser] Password actualizado en Auth`);
          }
      } catch (authErr) {
           console.warn("[UpdateUser] Excepción al actualizar Auth:", authErr.message);
      }
    }
    
    // 3. Actualizar datos en Auth si no es UUID
    if (isUUID(id) && (nombres_apellidos || username)) {
      try {
          const metadata = {};
          if (nombres_apellidos) metadata.nombres_apellidos = nombres_apellidos;
          if (username) metadata.username = username;
          
          const { error: metaError } = await supabase.auth.admin.updateUserById(
            id,
            { user_metadata: metadata }
          );
          if (metaError) {
              console.warn("[UpdateUser] Advertencia al actualizar metadata Auth:", metaError.message);
          }
      } catch (metaErr) {
          console.warn("[UpdateUser] Excepción al actualizar metadata Auth:", metaErr.message);
      }
    }

    res.json({ 
      message: "Usuario actualizado correctamente",
      user: updatedUser
    });

  } catch (err) {
    console.error("[UpdateUser] Error final:", err);
    res.status(500).json({ 
      error: err.message,
      hint: "Verifica que el usuario exista y que tengas permisos suficientes"
    });
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
