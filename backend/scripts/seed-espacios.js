import "dotenv/config";
import { supabase } from "../src/config/db.js";

/**
 * Script para crear manualmente los espacios de estacionamiento
 * Ejecución: node scripts/seed-espacios.js
 * 
 * Estructura:
 * - 30 Autos/Sedanes/Camionetas (A-1 a A-30)
 * - 15 Motos (M-1 a M-15)
 * Total: 45 espacios
 */

const seedEspacios = async () => {
  try {
    console.log("Iniciando creación de espacios de estacionamiento...\n");

    // Verificar si ya existen espacios
    const { data: existingSpaces, error: checkError } = await supabase
      .from("espacios")
      .select("id_espacio, codigo")
      .limit(1);

    if (checkError) throw checkError;

    if (existingSpaces && existingSpaces.length > 0) {
      console.log("[WARNING] Los espacios ya existen en la base de datos.");
      console.log("         Ejecute el script de limpieza primero si desea reiniciar.\n");
      return;
    }

    // Crear array con todos los espacios
    const espacios = [];

    // 30 Autos/Sedanes/Camionetas (código A-*, espacio_id = 1)
    console.log("Creando 30 espacios para Autos/Sedanes/Camionetas (A-1 a A-30)");
    for (let i = 1; i <= 30; i++) {
      espacios.push({
        codigo: `A-${i}`,
        espacio_id: 1, // Tipo: 1 = Auto/Sedán/Camioneta
        disponible: true
      });
    }

    // 15 Motos (código M-*, espacio_id = 3)
    console.log("Creando 15 espacios para Motos (M-1 a M-15)");
    for (let i = 1; i <= 15; i++) {
      espacios.push({
        codigo: `M-${i}`,
        espacio_id: 3, // Tipo: 3 = Moto
        disponible: true
      });
    }

    // Insertar en lotes para evitar problemas
    const batchSize = 10;
    let insertedCount = 0;

    for (let i = 0; i < espacios.length; i += batchSize) {
      const batch = espacios.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from("espacios")
        .insert(batch);

      if (error) throw error;

      insertedCount += batch.length;
      console.log(`   [OK] ${insertedCount}/${espacios.length} espacios creados`);
    }

    console.log("\n[SUCCESS] Espacios creados exitosamente!\n");
    console.log("Resumen:");
    console.log("   * Autos/Sedanes/Camionetas: 30 espacios (A-1 a A-30)");
    console.log("   * Motos: 15 espacios (M-1 a M-15)");
    console.log("   * Total: 45 espacios\n");

  } catch (error) {
    console.error("[ERROR] Error al crear espacios:", error.message);
    process.exit(1);
  }
};

seedEspacios().then(() => {
  process.exit(0);
});
