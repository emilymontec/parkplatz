/**
 * Utilidades para conversión de zonas horarias
 * Sistema configurado para: America/Bogota (UTC-5)
 * Usa date-fns-tz para máxima compatibilidad y precisión
 */

import { format, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'America/Bogota';

/**
 * Obtiene la hora actual en la zona horaria del sistema
 * @returns {Date} Objeto Date con la hora local
 */
export const getNowInTimezone = () => {
  const utcDate = new Date();
  return toZonedTime(utcDate, TIMEZONE);
};

/**
 * Convierte una fecha UTC a la zona horaria del sistema
 * @param {string | Date} utcDate - Fecha en formato ISO o Date object
 * @returns {Date} Objeto Date en hora local
 */
export const convertUTCToLocal = (utcDate) => {
  if (typeof utcDate === 'string') {
    return toZonedTime(parseISO(utcDate), TIMEZONE);
  }
  return toZonedTime(utcDate, TIMEZONE);
};

/**
 * Obtiene la hora local formateada para mostrar al usuario
 * Formato: DD/MM/YYYY HH:MM:SS
 * @param {string | Date} date - Fecha a formatear
 * @returns {string} Fecha formateada en timezone local
 */
export const formatLocalDate = (date) => {
  try {
    if (!date) {
      console.warn('[formatLocalDate] Fecha vacía recibida');
      return '';
    }
    
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const zonedDate = toZonedTime(dateObj, TIMEZONE);
    // No usar timeZone en format() - ya está convertida por toZonedTime()
    const formatted = format(zonedDate, 'dd/MM/yyyy HH:mm:ss');
    
    return formatted;
  } catch (error) {
    console.error('[formatLocalDate] Error:', error, 'Input:', date);
    return typeof date === 'string' ? date : new Date(date).toISOString();
  }
};

/**
 * Obtiene solo la hora local formateada (HH:MM:SS)
 * @param {string | Date} date - Fecha a formatear
 * @returns {string} Tiempo formateado
 */
export const formatLocalTime = (date) => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const zonedDate = toZonedTime(dateObj, TIMEZONE);
    return format(zonedDate, 'HH:mm:ss');
  } catch (error) {
    console.error('Error formateando hora:', error);
    return new Date(date).toLocaleTimeString('es-CO');
  }
};

/**
 * Obtiene solo la fecha local formateada (DD/MM/YYYY)
 * @param {string | Date} date - Fecha a formatear
 * @returns {string} Fecha formateada
 */
export const formatLocalDateOnly = (date) => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const zonedDate = toZonedTime(dateObj, TIMEZONE);
    return format(zonedDate, 'dd/MM/yyyy');
  } catch (error) {
    console.error('Error formateando fecha:', error);
    return new Date(date).toLocaleDateString('es-CO');
  }
};

/**
 * Obtiene la fecha actual como ISO string para guardar en BD
 * NOTA: Supabase siempre usa UTC, así que retorna ISO en UTC
 * @returns {string} ISO string en UTC para almacenar
 */
export const getCurrentISOString = () => {
  // Retorna ISO string en UTC puro (sin offset) para evitar ambigüedades en parseISO
  // Esto previene sumas incorrectas de minutos al calcular diferencias
  return new Date().toISOString();
};

/**
 * Calcula la diferencia en minutos entre dos fechas
 * Ambas fechas se asumen en UTC (como vienen de la BD)
 * @param {string | Date} startDate - Fecha de inicio
 * @param {string | Date} endDate - Fecha de fin
 * @returns {number} Diferencia en minutos (redondeada hacia arriba)
 */
export const calculateMinutesDifference = (startDate, endDate) => {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  
  let diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) diffMs = 0;
  
  return Math.ceil(diffMs / 60000);
};

/**
 * Calcula la diferencia en horas entre dos fechas
 * @param {string | Date} startDate - Fecha de inicio
 * @param {string | Date} endDate - Fecha de fin
 * @returns {number} Diferencia en horas (redondeada)
 */
export const calculateHoursDifference = (startDate, endDate) => {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  
  let diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) diffMs = 0;
  
  return Math.ceil(diffMs / 3600000);
};

/**
 * Obtiene el inicio del día actual en UTC (para consultas en Supabase)
 * Válido para la zona horaria America/Bogota
 * @returns {string} ISO string del inicio del día en UTC
 */
export const getTodayStartUTC = () => {
  const now = new Date();
  const zonedNow = toZonedTime(now, TIMEZONE);
  
  // Crear fecha a las 00:00:00 en la zona horaria local
  const startOfDay = new Date(zonedNow);
  startOfDay.setHours(0, 0, 0, 0);
  
  // Convertir de vuelta a UTC
  const utcStart = fromZonedTime(startOfDay, TIMEZONE);
  return utcStart.toISOString();
};

/**
 * Obtiene el final del día actual en UTC (para consultas en Supabase)
 * Válido para la zona horaria America/Bogota
 * @returns {string} ISO string del final del día en UTC
 */
export const getTodayEndUTC = () => {
  const now = new Date();
  const zonedNow = toZonedTime(now, TIMEZONE);
  
  // Crear fecha a las 23:59:59.999 en la zona horaria local
  const endOfDay = new Date(zonedNow);
  endOfDay.setHours(23, 59, 59, 999);
  
  // Convertir de vuelta a UTC
  const utcEnd = fromZonedTime(endOfDay, TIMEZONE);
  return utcEnd.toISOString();
};

/**
 * Información de la zona horaria configurada
 * @returns {object} Detalles de la zona horaria
 */
export const getTimezoneInfo = () => {
  const now = new Date();
  const zonedNow = toZonedTime(now, TIMEZONE);
  
  return {
    timezone: TIMEZONE,
    description: 'Colombia (UTC-5)',
    currentTime: format(zonedNow, 'dd/MM/yyyy HH:mm:ss'),
    startOfToday: getTodayStartUTC(),
    endOfToday: getTodayEndUTC()
  };
};
