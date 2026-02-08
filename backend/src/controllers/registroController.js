import { supabase } from "../config/db.js";

/**
 * Obtener vehículos con entrada activa
 * Ruta protegida: Solo OPERARIO
 */
export const getActiveVehicles = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("registros")
      .select(`
        id_registro,
        placa,
        vehiculo_id,
        tipos_vehiculo(nombre),
        espacio_id,
        entrada,
        salida,
        estado,
        usuario_entrada,
        valor_calculado
      `)
      .eq("estado", "EN_CURSO")
      .order("entrada", { ascending: false });

    if (error) throw error;
    
    res.json(data);
  } catch (err) {
    console.error("Error getting active vehicles:", err);
    res.status(500).json({ 
      error: err.message,
      code: "DB_ERROR"
    });
  }
};

/**
 * Registrar entrada de vehículo
 * Ruta protegida: Solo OPERARIO
 */
export const registerEntry = async (req, res) => {
  const { placa, tipo_vehiculo_id, espacio_id } = req.body;

  if (!placa || !tipo_vehiculo_id) {
    return res.status(400).json({ 
      error: "Placa y tipo de vehículo son requeridos",
      code: "MISSING_FIELDS"
    });
  }

  try {
    // Verificar si ya tiene entrada activa
    const { data: existing, error: checkError } = await supabase
      .from("registros")
      .select("id_registro")
      .eq("placa", placa)
      .eq("estado", "EN_CURSO")
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    if (existing) {
      return res.status(400).json({ 
        error: "El vehículo ya tiene una entrada activa",
        code: "DUPLICATE_ENTRY"
      });
    }

    // VERIFICAR CAPACIDAD
    // Obtener configuración de capacidad (Hardcoded por ahora)
    const CAPACITY = {
      AUTO: 30, // IDs 1 (Sedan) y 2 (Camioneta)
      MOTO: 15  // ID 3 (Moto)
    };

    // Determinar categoría
    const isMoto = parseInt(tipo_vehiculo_id) === 3;
    const isAuto = !isMoto; // 1 y 2

    // Contar vehículos activos de la misma categoría
    const { count, error: countError } = await supabase
      .from("registros")
      .select("id_registro", { count: "exact", head: true })
      .eq("estado", "EN_CURSO")
      .in("vehiculo_id", isMoto ? [3] : [1, 2]);

    if (countError) throw countError;

    const limit = isMoto ? CAPACITY.MOTO : CAPACITY.AUTO;
    
    if (count >= limit) {
      return res.status(400).json({
        error: `No hay cupos disponibles para ${isMoto ? 'Motos' : 'Autos'}`,
        code: "FULL_CAPACITY"
      });
    }

    // Preparar datos para insertar
    const registroData = {
      placa,
      vehiculo_id: tipo_vehiculo_id,
      entrada: new Date().toISOString(),
      estado: "EN_CURSO",
      usuario_entrada: req.user.id
    };

    // Manejo inteligente de Espacio ID (Auto-asignación)
    if (espacio_id) {
      registroData.espacio_id = espacio_id;
    } else {
      // 1. Buscar un espacio existente para este tipo de vehículo
      // Nota: En tabla 'espacios', la columna 'espacio_id' es la FK a 'tipos_vehiculo'
      const { data: espacioExistente, error: errorBusqueda } = await supabase
        .from('espacios')
        .select('id_espacio')
        .eq('espacio_id', tipo_vehiculo_id) // 'espacio_id' en tabla espacios es el tipo de vehículo
        .limit(1)
        .maybeSingle();

      if (espacioExistente) {
        registroData.espacio_id = espacioExistente.id_espacio;
      } else {
        // 2. Si no existe, crear uno automáticamente (Auto-provisioning)
        // Esto soluciona el problema de tabla vacía sin necesidad de seeds manuales
        const codigoGenerico = `GEN-${tipo_vehiculo_id}-01`;
        
        const { data: nuevoEspacio, error: errorCreacion } = await supabase
          .from('espacios')
          .insert([{
            codigo: codigoGenerico,
            espacio_id: tipo_vehiculo_id, // Tipo de vehículo
            disponible: true
          }])
          .select('id_espacio')
          .single();

        if (errorCreacion) {
          // Si falla (ej. código duplicado), intentar buscar de nuevo por si se creó en otra request
          console.error("Error creando espacio automático:", errorCreacion);
           throw new Error(`Error de configuración: No hay espacios definidos para el tipo ${tipo_vehiculo_id}`);
        }

        registroData.espacio_id = nuevoEspacio.id_espacio;
      }
    }

    // Insertar registro de entrada
    const { data, error } = await supabase
      .from("registros")
      .insert([registroData])
      .select(`
        id_registro,
        placa,
        vehiculo_id,
        espacio_id,
        entrada,
        estado
      `)
      .single();

    if (error) throw error;
    
    res.status(201).json({ 
      message: "Entrada registrada",
      data
    });
  } catch (err) {
    console.error("Error registering entry:", err);
    res.status(500).json({ 
      error: err.message,
      code: "DB_ERROR"
    });
  }
};

/**
 * Registrar salida de vehículo y calcular costo
 * Ruta protegida: Solo OPERARIO
 */
export const registerExit = async (req, res) => {
  const { placa } = req.body;

  if (!placa) {
    return res.status(400).json({ 
      error: "Placa es requerida",
      code: "MISSING_FIELDS"
    });
  }

  try {
    // Buscar registro activo
    const { data: registro, error: findError } = await supabase
      .from("registros")
      .select(`
        id_registro,
        entrada,
        tarifa_id,
        tarifas(valor, tipo_cobro)
      `)
      .eq("placa", placa)
      .eq("estado", "EN_CURSO")
      .single();

    if (findError || !registro) {
      return res.status(404).json({ 
        error: "No se encontró entrada activa para esta placa",
        code: "NOT_FOUND"
      });
    }

    // Calcular tiempo y costo
    const entrada = new Date(registro.entrada);
    const salida = new Date();
    const diffMs = salida - entrada;
    const diffMins = Math.ceil(diffMs / 60000);
    
    // Tarifa: Si existe tarifa en BD usarla, sino $100 por minuto por defecto
    let costoTotal = 0;
    
    if (registro.tarifas) {
      const tarifa = registro.tarifas;
      const valor = parseFloat(tarifa.valor);
      
      switch (tarifa.tipo_cobro) {
        case 'POR_MINUTO':
          costoTotal = diffMins * valor;
          break;
        case 'POR_HORA':
          costoTotal = Math.ceil(diffMins / 60) * valor;
          break;
        case 'POR_DIA':
          costoTotal = Math.ceil(diffMins / (24 * 60)) * valor;
          break;
        case 'FRACCION':
          // Por cada fracción (ej: cada 15 min)
          costoTotal = Math.ceil(diffMins / 15) * valor;
          break;
        default:
          costoTotal = diffMins * 100; // Fallback
      }
    } else {
      // Tarifa por defecto
      costoTotal = diffMins * 100;
    }

    // Actualizar registro con salida
    const { data, error } = await supabase
      .from("registros")
      .update({
        salida: salida.toISOString(),
        estado: "FINALIZADO",
        total_minutos: diffMins,
        valor_calculado: costoTotal,
        usuario_salida: req.user.id
      })
      .eq("id_registro", registro.id_registro)
      .select()
      .single();

    if (error) throw error;
    
    res.json({ 
      message: "Salida registrada",
      data,
      duracion_minutos: diffMins,
      costo_total: costoTotal
    });
  } catch (err) {
    console.error("Error registering exit:", err);
    res.status(500).json({ 
      error: err.message,
      code: "DB_ERROR"
    });
  }
};
