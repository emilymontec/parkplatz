import { supabase } from "../config/db.js";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { getTodayStartUTC, getTodayEndUTC, formatLocalDate } from "../utils/dateUtils.js";
import { startOfMonth, endOfMonth, parseISO, format } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

const TIMEZONE = 'America/Bogota';

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
      gananciasHoy: gananciasTotal, // Ahora sumamos con filtro > 0
      vehiculosHoy: vehiculosHoy || 0,
      espaciosDisponibles: espaciosDisponibles >= 0 ? espaciosDisponibles : 0,
      gananciasDetalle: gananciasData
    });

  } catch (err) {
    console.error("Error getting dashboard stats:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Obtener historial de registros (paginado)
 */
export const getRegistrosHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("registros")
      .select(`
        *,
        tipos_vehiculo(nombre),
        tarifas(nombre, valor)
      `, { count: "exact" })
      .order("entrada", { ascending: false })
      .range(from, to);

    if (search) {
      query = query.ilike("placa", `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      data,
      count,
      page: Number(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (err) {
    console.error("Error getting history:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Obtener usuarios
 */
export const getUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select(`
        id_usuario,
        username,
        nombres_apellidos,
        rol_id,
        activo,
        roles (nombre)
      `)
      .order("nombres_apellidos");

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Obtener roles
 */
export const getRoles = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("roles")
            .select("*")
            .order("id_rol");
        
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Crear usuario
 */
export const createUser = async (req, res) => {
  try {
    const { username, password, nombres_apellidos, rol_id } = req.body;

    // Validar que el rol existe
    const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id_rol')
        .eq('id_rol', rol_id)
        .single();
    
    if (roleError || !roleData) {
        return res.status(400).json({ error: "Rol inválido" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { data, error } = await supabase
      .from("usuarios")
      .insert([{
        username,
        password_hash,
        nombres_apellidos,
        rol_id,
        activo: true
      }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique violation
        return res.status(400).json({ error: "El nombre de usuario ya existe" });
    }
    res.status(500).json({ error: err.message });
  }
};

/**
 * Actualizar usuario
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, nombres_apellidos, rol_id } = req.body;

    // Validar rol si se envía
    if (rol_id) {
        const { data: roleData, error: roleError } = await supabase
            .from('roles')
            .select('id_rol')
            .eq('id_rol', rol_id)
            .single();
        if (roleError || !roleData) {
            return res.status(400).json({ error: "Rol inválido" });
        }
    }

    const updates = {
      username,
      nombres_apellidos,
      rol_id
    };

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updates.password_hash = await bcrypt.hash(password, salt);
    }

    const { data, error } = await supabase
      .from("usuarios")
      .update(updates)
      .eq("id_usuario", id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Activar/Desactivar usuario
 */
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener estado actual
    const { data: user } = await supabase
      .from("usuarios")
      .select("activo")
      .eq("id_usuario", id)
      .single();

    const { data, error } = await supabase
      .from("usuarios")
      .update({ activo: !user.activo })
      .eq("id_usuario", id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Restablecer contraseña de usuario
 */
export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const defaultPassword = process.env.DEFAULT_RESET_PASSWORD;
    
    if (!defaultPassword) {
        throw new Error('La configuración de restablecimiento no está disponible (Variable de entorno faltante).');
    }
    
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(defaultPassword, salt);

    const { data, error } = await supabase
      .from("usuarios")
      .update({ password_hash })
      .eq("id_usuario", id)
      .select();

    if (error) throw error;
    
    res.json({ message: 'Contraseña restablecida correctamente', user: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DEBUG: Obtener todos los registros de hoy sin filtros de estado
 */
export const getRegistrosDebug = async (req, res) => {
    try {
        const startOfDay = getTodayStartUTC();
        const endOfDay = getTodayEndUTC();

        console.log('DEBUG QUERY RANGE:', { startOfDay, endOfDay });

        const { data, error } = await supabase
            .from("registros")
            .select(`
                *,
                tarifas (nombre)
            `)
            .gte("entrada", startOfDay)
            .lte("entrada", endOfDay);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error("Error debug:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Gestión de Espacios (Parking Spaces)
 */
export const getEspacios = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("espacios")
            .select(`
                *,
                tipos_vehiculo (nombre)
            `)
            .order("id_espacio");

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const resetEspacios = async (req, res) => {
    try {
        // Pone todos los espacios en disponible=true
        const { error } = await supabase
            .from("espacios")
            .update({ disponible: true })
            .neq("id_espacio", 0); // Actualiza todos

        if (error) throw error;
        res.json({ message: "Espacios reseteados correctamente" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Generar Reporte Mensual (CSV)
 */
export const getMonthlyReport = async (req, res) => {
  try {
    const { month } = req.query; // YYYY-MM
    let startDate, endDate;
    let reportMonth = month;

    if (month) {
        const date = parseISO(month + '-01'); // e.g. 2023-10-01
        
        // Inicio del mes en zona horaria
        const startLocal = startOfMonth(toZonedTime(date, TIMEZONE));
        startDate = fromZonedTime(startLocal, TIMEZONE).toISOString();

        // Fin del mes en zona horaria
        const endLocal = endOfMonth(toZonedTime(date, TIMEZONE));
        endLocal.setHours(23, 59, 59, 999);
        endDate = fromZonedTime(endLocal, TIMEZONE).toISOString();
    } else {
        // Default: Mes actual
        const now = new Date();
        const zonedNow = toZonedTime(now, TIMEZONE);
        
        reportMonth = format(zonedNow, 'yyyy-MM');
        
        const startLocal = startOfMonth(zonedNow);
        startDate = fromZonedTime(startLocal, TIMEZONE).toISOString();

        const endLocal = endOfMonth(zonedNow);
        endLocal.setHours(23, 59, 59, 999);
        endDate = fromZonedTime(endLocal, TIMEZONE).toISOString();
    }

    // Query Registros
    const { data, error } = await supabase
        .from("registros")
        .select(`
            fecha_entrada:entrada,
            fecha_salida:salida,
            placa,
            vehiculo_id,
            tipos_vehiculo(nombre),
            tarifas(nombre, valor),
            valor_calculado,
            estado,
            usuario_entrada,
            usuario_salida
        `)
        .gte('entrada', startDate)
        .lte('entrada', endDate)
        .order('entrada', { ascending: true });

    if (error) throw error;

    // Helper para CSV
    const toCSVField = (field) => {
        if (field === null || field === undefined) return '';
        const stringField = String(field);
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
            return `"${stringField.replace(/"/g, '""')}"`;
        }
        return stringField;
    };

    const headers = [
        'Fecha Entrada', 
        'Fecha Salida', 
        'Placa', 
        'Tipo Vehiculo', 
        'Tarifa Aplicada', 
        'Valor Cobrado', 
        'Estado', 
        'Operario Entrada', 
        'Operario Salida'
    ];

    const rows = data.map(row => {
        return [
            formatLocalDate(row.fecha_entrada),
            row.fecha_salida ? formatLocalDate(row.fecha_salida) : 'En Curso',
            toCSVField(row.placa),
            toCSVField(row.tipos_vehiculo?.nombre),
            toCSVField(row.tarifas?.nombre),
            row.valor_calculado || 0,
            toCSVField(row.estado),
            toCSVField(row.usuario_entrada),
            toCSVField(row.usuario_salida)
        ].join(',');
    });

    // Agregar BOM para Excel y codificación UTF-8
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-${reportMonth}.csv"`);
    res.send(csvContent);

  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ error: err.message });
  }
};
