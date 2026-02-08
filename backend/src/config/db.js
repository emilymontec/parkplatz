import { createClient } from "@supabase/supabase-js";

// Usar Service Role Key si está disponible para evitar restricciones RLS en backend
// Si no, usar la Key estándar (que podría ser Anon y causar errores de permisos)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Error: Faltan variables de entorno SUPABASE_URL o SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY");
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
  }
);
