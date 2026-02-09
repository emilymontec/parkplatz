import { supabase } from "../config/db.js";
import { getCurrentISOString, calculateMinutesDifference, formatLocalDate, formatLocalTime } from "../utils/dateUtils.js";

const CAPACITY = {
  AUTO: 30, // IDs 1 (Sedan) y 2 (Camioneta)
  MOTO: 15  // ID 3 (Moto)
};

/**
 * Obtener estado de cupos (Autos vs Motos) basado en tabla ESPACIOS
 * Ruta protegida: Solo OPERARIO
 */
export const getQuotaStats = async (req, res) => {
  try {
    // Obtener espacios disponibles y ocupados por tipo
    const { data: autosData, error: autosError } = await supabase
      .from("espacios")
      .select("id_espacio, disponible")
      .eq("espacio_id", 1); // 1 = Auto/Sedán/Camioneta

    if (autosError) throw autosError;

    const { data: motosData, error: motosError } = await supabase
      .from("espacios")
      .select("id_espacio, disponible")
      .eq("espacio_id", 3); // 3 = Moto

    if (motosError) throw motosError;

    // Contar disponibles y ocupados
    const autosOcupados = autosData ? autosData.filter(e => !e.disponible).length : 0;
    const autosDisponibles = autosData ? autosData.filter(e => e.disponible).length : 0;
    const autosTotal = autosData ? autosData.length : 30;

    const motosOcupadas = motosData ? motosData.filter(e => !e.disponible).length : 0;
    const motosDisponibles = motosData ? motosData.filter(e => e.disponible).length : 0;
    const motosTotal = motosData ? motosData.length : 15;

    res.json({
      autos: {
        active: autosOcupados,
        total: autosTotal,
        available: autosDisponibles
      },
      motos: {
        active: motosOcupadas,
        total: motosTotal,
        available: motosDisponibles
      },
      total: {
        active: autosOcupados + motosOcupadas,
        limit: autosTotal + motosTotal,
        available: autosDisponibles + motosDisponibles
      }
    });

  } catch (err) {
    console.error("Error getting quota stats:", err);
    res.status(500).json({ error: err.message });
  }
};

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

  // Validar formato de placa (3 letras + 3 números o 3 letras + 2 números + 1 letra/número)
  const plateRegex = /^[A-Z]{3}[0-9]{2}[A-Z0-9]$/;
  if (!plateRegex.test(placa)) {
    return res.status(400).json({
      error: "Formato de placa inválido (Debe ser AAA123 o AAA12B)",
      code: "INVALID_PLATE_FORMAT"
    });
  }

  try {
    // Verificar que el usuario autenticado existe en BD
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Usuario no autenticado correctamente",
        code: "INVALID_USER"
      });
    }

    // Verificar que el usuario existe en la BD
    const { data: userExists, error: userCheckError } = await supabase
      .from("usuarios")
      .select("id_usuario")
      .eq("id_usuario", userId)
      .maybeSingle();

    if (userCheckError) throw userCheckError;
    if (!userExists) {
      return res.status(401).json({
        error: "Usuario no encontrado en BD",
        code: "USER_NOT_FOUND"
      });
    }

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
    // CAPACITY está definido a nivel de módulo

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

    // Buscar tarifa ACTIVA para el tipo de vehículo (Asignación al entrar)
    const { data: tarifaActiva, error: tarifaError } = await supabase
      .from('tarifas')
      .select('id_tarifa')
      .eq('tipo_vehiculo_id', tipo_vehiculo_id)
      .eq('activo', true)
      .order('id_tarifa', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tarifaError) throw tarifaError;

    // Preparar datos para insertar
    // Usar getCurrentISOString() que maneja la zona horaria correctamente
    const registroData = {
      placa,
      vehiculo_id: tipo_vehiculo_id,
      entrada: getCurrentISOString(),
      estado: "EN_CURSO",
      usuario_entrada: userId, // Ya validado que existe
      tarifa_id: tarifaActiva ? tarifaActiva.id_tarifa : null
    };

    // Manejo ATÓMICO de Espacio ID (Prevención de Race Conditions)
    // Garantiza que NUNCA se asigne un espacio ocupado
    if (espacio_id) {
      // Intento de ocupación atómica
      const { data: updatedSpace, error: updateError } = await supabase
        .from('espacios')
        .update({ disponible: false })
        .eq('id_espacio', espacio_id)
        .eq('disponible', true) // Condición crítica: debe estar disponible
        .select()
        .single();

      if (updateError && updateError.code !== 'PGRST116') { // PGRST116 es 'No rows returned'
          throw updateError;
      }

      if (!updatedSpace) {
          // Si no se actualizó, verificar si existe para dar el error correcto
          const { data: spaceExists } = await supabase
            .from('espacios')
            .select('id_espacio')
            .eq('id_espacio', espacio_id)
            .single();
          
          if (!spaceExists) {
             return res.status(400).json({ error: "El espacio seleccionado no existe", code: "INVALID_SPACE" });
          } else {
             return res.status(400).json({ error: "El espacio seleccionado ya está ocupado", code: "SPACE_OCCUPIED" });
          }
      }

      registroData.espacio_id = espacio_id;

    } else {
      // Auto-asignación: Buscar espacio DISPONIBLE por tipo de vehículo y ocuparlo
      // Usar espacio_id (1 para autos, 3 para motos)
      const espacioTypeId = isMoto ? 3 : 1;
      
      const { data: candidates, error: searchError } = await supabase
        .from('espacios')
        .select('id_espacio, codigo')
        .eq('espacio_id', espacioTypeId) // Filtrar por tipo de vehículo
        .eq('disponible', true)
        .order('id_espacio', { ascending: true })
        .limit(1); // Traer solo el primero disponible

      if (searchError) throw searchError;

      let assignedSpaceId = null;

      if (candidates && candidates.length > 0) {
        const spaceToOccupy = candidates[0];
        
        // Ocupar el espacio atómicamente
        const { data: occupiedSpace, error: occupyError } = await supabase
          .from('espacios')
          .update({ disponible: false })
          .eq('id_espacio', spaceToOccupy.id_espacio)
          .eq('disponible', true) // Garantiza que sigue disponible
          .select('id_espacio')
          .single();

        if (occupyError && occupyError.code !== 'PGRST116') {
          throw occupyError;
        }

        if (occupiedSpace) {
          assignedSpaceId = occupiedSpace.id_espacio;
        } else {
          return res.status(400).json({
            error: `No hay espacios disponibles para ${isMoto ? 'Motos' : 'Autos'}`,
            code: "NO_AVAILABLE_SPACES"
          });
        }
      } else {
        return res.status(400).json({
          error: `No hay espacios disponibles para ${isMoto ? 'Motos' : 'Autos'}`,
          code: "FULL_CAPACITY"
        });
      }

      if (assignedSpaceId) {
        registroData.espacio_id = assignedSpaceId;
      } else {
        return res.status(400).json({
          error: "No se pudo asignar espacio",
          code: "SPACE_ASSIGNMENT_FAILED"
        });  
      }
    }

    // Insertar registro de entrada
    // Si esto falla, debemos liberar el espacio (Compensating Transaction)
    let data, error;
    try {
        const result = await supabase
        .from("registros")
        .insert([registroData])
        .select(`
            id_registro,
            placa,
            vehiculo_id,
            espacio_id,
            entrada,
            estado,
            tipos_vehiculo (
              nombre
            )
        `)
        .single();
        data = result.data;
        error = result.error;
    } catch (insertErr) {
        error = insertErr;
    }

    if (error) {
        // Rollback: Liberar espacio
        if (registroData.espacio_id) {
          await supabase
            .from('espacios')
            .update({ disponible: true })
            .eq('id_espacio', registroData.espacio_id);
        }
        throw error;
    }
    
    // El espacio ya fue marcado como ocupado antes del insert
    console.log('[registerEntry] Response data:', JSON.stringify(data, null, 2));

    // Obtener el código del espacio asignado (consulta separada para evitar dependencia de relación FK)
    let espacioCodigo = null;
    if (data.espacio_id) {
      const { data: espRow, error: espErr } = await supabase
        .from('espacios')
        .select('codigo')
        .eq('id_espacio', data.espacio_id)
        .maybeSingle();

      if (!espErr && espRow) espacioCodigo = espRow.codigo;
    }

    const responseData = {
      ...data,
      entrada_formateada: formatLocalDate(data.entrada),
      espacios: { codigo: espacioCodigo || 'Sin asignar' }
    };

    res.status(201).json({ 
      message: "Entrada registrada",
      data: responseData
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
    // Buscar registro activo con tarifa asignada
    const { data: registro, error: findError } = await supabase
      .from("registros")
      .select(`
        id_registro,
        entrada,
        tarifa_id,
        vehiculo_id,
        espacio_id,
        tarifas(id_tarifa, valor, tipo_cobro)
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

    // ---------------------------------------------------------
    // 1. Hora salida
    // ---------------------------------------------------------
    const salida = getCurrentISOString();

    // ---------------------------------------------------------
    // 2. Minutos totales
    // ---------------------------------------------------------
    const diffMins = calculateMinutesDifference(registro.entrada, salida);
    
    // ---------------------------------------------------------
    // 3. Obtener tarifa aplicable
    // ---------------------------------------------------------
    let tarifaActiva = null;

    // A. Prioridad: Usar la tarifa asignada al ingreso (snapshot histórico)
    // Esto cumple con el requisito: "Cambios aplican a nuevos registros"
    if (registro.tarifa_id) {
        const { data: tarifaSnapshot } = await supabase
            .from('tarifas')
            .select('*')
            .eq('id_tarifa', registro.tarifa_id)
            .maybeSingle();
            
        if (tarifaSnapshot) {
            tarifaActiva = tarifaSnapshot;
        }
    }

    // B. Fallback: Si no tiene tarifa asignada (registros antiguos) o no se encontró, buscar la vigente actual
    if (!tarifaActiva) {
        const { data: tarifaVigente } = await supabase
          .from('tarifas')
          .select('*')
          .eq('tipo_vehiculo_id', registro.vehiculo_id)
          .eq('activo', true)
          .order('id_tarifa', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        tarifaActiva = tarifaVigente;
    }

    // ---------------------------------------------------------
    // 4. Calcular valor
    // ---------------------------------------------------------
    let costoTotal = 0;
    let tarifaUsadaId = registro.tarifa_id; // Fallback al ID original si no se encuentra nueva

    if (tarifaActiva) {
      tarifaUsadaId = tarifaActiva.id_tarifa;
      const valor = parseFloat(tarifaActiva.valor);
      const tipoCobro = tarifaActiva.tipo_cobro;

      if (isNaN(valor) || valor < 0) {
        costoTotal = 0; // Valor inválido en BD
      } else {
        switch (tipoCobro) {
          case 'POR_MINUTO':
            costoTotal = diffMins * valor;
            break;
          case 'POR_HORA':
            costoTotal = Math.ceil(diffMins / 60) * valor;
            break;
          case 'POR_DIA':
            costoTotal = Math.ceil(diffMins / (24 * 60)) * valor;
            break;
          case 'FRACCION': // Ejemplo: Cobro por fracción de 15 min
            costoTotal = Math.ceil(diffMins / 15) * valor;
            break;
          default:
            costoTotal = diffMins * valor;
        }
      }
    } else {
      // Fallback: Si no hay tarifa activa, usar un valor por defecto o 0
      // Para evitar bloqueos, calculamos $100/min como emergencia
      console.warn("No se encontró tarifa activa. Usando tarifa de emergencia ($100/min).");
      costoTotal = diffMins * 100;
    }
    
    // Validar final
    if (costoTotal < 0) costoTotal = 0;
    costoTotal = Math.round(costoTotal * 100) / 100;

    // Actualizar registro con salida
    const { data, error } = await supabase
      .from("registros")
      .update({
        salida: salida,
        estado: "FINALIZADO",
        total_minutos: diffMins,
        valor_calculado: costoTotal,
        usuario_salida: req.user?.id || null, // Opcional si no hay usuario válido
        tarifa_id: tarifaUsadaId // Actualizamos la tarifa usada realmente
      })
      .eq("id_registro", registro.id_registro)
      .select()
      .single();

    if (error) throw error;

    // LIBERAR ESPACIO
    if (registro.espacio_id) {
      await supabase
        .from('espacios')
        .update({ disponible: true })
        .eq('id_espacio', registro.espacio_id);
    }
    
    const responseData = {
      ...data,
      entrada_formateada: formatLocalDate(data.entrada),
      salida_formateada: formatLocalDate(data.salida)
    };
    
    res.json({ 
      message: "Salida registrada",
      data: responseData,
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

/**
 * Previsualizar salida (Cálculo de cobro sin procesar)
 * Ruta protegida: Solo OPERARIO
 */
export const previewExit = async (req, res) => {
  const { placa } = req.query;

  if (!placa) {
    return res.status(400).json({ error: "Placa es requerida" });
  }

  try {
    // Buscar registro activo
    const { data: registro, error: findError } = await supabase
      .from("registros")
      .select(`
        id_registro,
        entrada,
        placa,
        vehiculo_id,
        tipos_vehiculo(nombre)
      `)
      .eq("placa", placa)
      .eq("estado", "EN_CURSO")
      .maybeSingle();

    if (findError || !registro) {
      return res.status(404).json({ error: "No se encontró vehículo activo con esta placa" });
    }

    // Calcular tiempo
    const salida = getCurrentISOString();
    const diffMins = calculateMinutesDifference(registro.entrada, salida);
    
    // Obtener tarifa aplicable (Prioridad: Asignada al ingreso > Vigente actual)
    let tarifaActiva = null;

    if (registro.tarifa_id) { // Check if we have a locked tariff from entry
        // Fetch specific tariff (even if inactive now)
        const { data: tarifaSnapshot } = await supabase
            .from('tarifas')
            .select('*')
            .eq('id_tarifa', registro.tarifa_id) // Use the stored ID
            .maybeSingle();
            
        if (tarifaSnapshot) {
            tarifaActiva = tarifaSnapshot;
        }
    }

    // Fallback if no stored tariff or not found
    if (!tarifaActiva) {
        const { data: tarifaVigente } = await supabase
            .from('tarifas')
            .select('*')
            .eq('tipo_vehiculo_id', registro.vehiculo_id)
            .eq('activo', true)
            .order('id_tarifa', { ascending: false })
            .limit(1)
            .maybeSingle();
        tarifaActiva = tarifaVigente;
    }

    let costoTotal = 0;
    let tarifaNombre = "Tarifa por defecto ($100/min)";
    
    if (tarifaActiva) {
      tarifaNombre = tarifaActiva.nombre;
      const valor = parseFloat(tarifaActiva.valor);
      const tipoCobro = tarifaActiva.tipo_cobro;
      
      if (isNaN(valor) || valor < 0) {
          costoTotal = diffMins * 100;
          tarifaNombre += " (Valor inválido, fallback)";
      } else {
          switch (tipoCobro) {
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
              costoTotal = Math.ceil(diffMins / 15) * valor;
              break;
            default:
              costoTotal = diffMins * valor;
          }
      }
    } else {
      costoTotal = diffMins * 100;
      console.warn(`[previewExit] No se encontró tarifa activa para vehiculo ${registro.vehiculo_id}. Usando fallback.`);
    }
    
    if (costoTotal < 0) costoTotal = 0;

    // Redondear a 2 decimales para visualización limpia
    costoTotal = Math.round(costoTotal * 100) / 100;

    res.json({
      placa: registro.placa,
      tipo_vehiculo: registro.tipos_vehiculo?.nombre,
      entrada: registro.entrada,
      entrada_formateada: formatLocalDate(registro.entrada),
      salida_estimada: salida,
      salida_estimada_formateada: formatLocalDate(salida),
      duracion_minutos: diffMins,
      tarifa_nombre: tarifaNombre,
      costo_total: costoTotal
    });

  } catch (err) {
    console.error("Error previewing exit:", err);
    res.status(500).json({ error: err.message });
  }
};
