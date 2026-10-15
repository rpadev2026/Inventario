import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./tipos";

/** Argumento NULL de una función SQL que lo acepta: los tipos generados no lo admiten en parámetros sin DEFAULT. */
export const nulo = null as never;

// Solo servidor: usa service_role. Nunca importar desde componentes cliente.
export const db = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
