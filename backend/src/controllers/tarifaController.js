import { supabase } from "../config/db.js";

/**
 * Obtener todas las tarifas
 * Ruta protegida: Solo ADMINISTRADOR
 */
export const getTarifas = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tarifas")
      .select(`
        id_tarifa,
        tipo_vehiculo_id,
        tipos_vehiculo(nombre),
        nombre,
        tipo_cobro,
        valor,
        activo,
        fecha_inicio,
        fecha_fin
      `)
      .order("id_tarifa", { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Error getting tarifas:", err);
    res.status(500).json({ 
      error: err.message,
      code: "DB_ERROR"
    });
  }
};

/**
 * Crear nueva tarifa
 * Ruta protegida: Solo ADMINISTRADOR
 */
export const createTarifa = async (req, res) => {
  const { tipo_vehiculo_id, nombre, tipo_cobro, valor, fecha_inicio, fecha_fin } = req.body;

  if (!tipo_vehiculo_id || !nombre || !tipo_cobro || !valor || !fecha_inicio) {
    return res.status(400).json({ 
      error: "Campos requeridos: tipo_vehiculo, nombre, tipo_cobro, valor, fecha_inicio",
      code: "MISSING_FIELDS"
    });
  }

  try {
    const { data, error } = await supabase
      .from("tarifas")
      .insert([{
        tipo_vehiculo_id,
        nombre,
        tipo_cobro,
        valor,
        fecha_inicio,
        fecha_fin: fecha_fin || null,
        activo: true
      }])
      .select(`
        id_tarifa,
        tipo_vehiculo_id,
        tipos_vehiculo(nombre),
        nombre,
        tipo_cobro,
        valor,
        activo,
        fecha_inicio,
        fecha_fin
      `)
      .single();

    if (error) throw error;

    res.status(201).json({
      message: "Tarifa creada exitosamente",
      tarifa: data
    });

  } catch (err) {
    console.error("Error creating tarifa:", err);
    res.status(500).json({ 
      error: err.message,
      code: "DB_ERROR"
    });
  }
};

/**
 * Actualizar tarifa existente
 * Ruta protegida: Solo ADMINISTRADOR
 */
export const updateTarifa = async (req, res) => {
  const { id } = req.params;
  const { tipo_vehiculo_id, nombre, tipo_cobro, valor, fecha_inicio, fecha_fin } = req.body;

  if (!id) {
    return res.status(400).json({ 
      error: "ID de tarifa requerido",
      code: "MISSING_ID"
    });
  }

  try {
    const updates = {};
    if (tipo_vehiculo_id) updates.tipo_vehiculo_id = tipo_vehiculo_id;
    if (nombre) updates.nombre = nombre;
    if (tipo_cobro) updates.tipo_cobro = tipo_cobro;
    if (valor) updates.valor = valor;
    if (fecha_inicio) updates.fecha_inicio = fecha_inicio;
    if (fecha_fin !== undefined) updates.fecha_fin = fecha_fin; // Permitir null

    const { data, error } = await supabase
      .from("tarifas")
      .update(updates)
      .eq("id_tarifa", id)
      .select(`
        id_tarifa,
        tipo_vehiculo_id,
        tipos_vehiculo(nombre),
        nombre,
        tipo_cobro,
        valor,
        activo,
        fecha_inicio,
        fecha_fin
      `)
      .single();

    if (error) throw error;

    res.json({
      message: "Tarifa actualizada exitosamente",
      tarifa: data
    });

  } catch (err) {
    console.error("Error updating tarifa:", err);
    res.status(500).json({ 
      error: err.message,
      code: "DB_ERROR"
    });
  }
};

/**
 * Activar/Desactivar tarifa
 * Ruta protegida: Solo ADMINISTRADOR
 */
export const toggleTarifaStatus = async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;

  if (!id || typeof activo !== 'boolean') {
    return res.status(400).json({ 
      error: "ID y estado (activo) son requeridos",
      code: "MISSING_FIELDS"
    });
  }

  try {
    const { data, error } = await supabase
      .from("tarifas")
      .update({ activo })
      .eq("id_tarifa", id)
      .select(`
        id_tarifa,
        tipo_vehiculo_id,
        tipos_vehiculo(nombre),
        nombre,
        tipo_cobro,
        valor,
        activo,
        fecha_inicio,
        fecha_fin
      `)
      .single();

    if (error) throw error;

    res.json({
      message: `Tarifa ${activo ? 'activada' : 'desactivada'}`,
      tarifa: data
    });

  } catch (err) {
    console.error("Error toggling tarifa status:", err);
    res.status(500).json({ 
      error: err.message,
      code: "DB_ERROR"
    });
  }
};

/**
 * Obtener tipos de vehículo
 * Ruta protegida: Solo ADMINISTRADOR
 */
export const getTiposVehiculo = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tipos_vehiculo")
      .select("*")
      .order("id_vehiculo", { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Error getting tipos vehiculo:", err);
    res.status(500).json({ 
      error: err.message,
      code: "DB_ERROR"
    });
  }
};
