import "server-only";
import { createClient } from "@supabase/supabase-js";

// Solo servidor: usa service_role. Nunca importar desde componentes cliente.
export const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
