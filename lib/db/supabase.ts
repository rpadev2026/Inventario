import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./tipos";

/** Argumento NULL de una función SQL que lo acepta: los tipos generados no lo admiten en parámetros sin DEFAULT. */
export const nulo = null as never;

const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
const url = process.env.SUPABASE_URL!;
const tokenApp = process.env.SUPABASE_APP_TOKEN;

// Solo servidor. Nunca importar desde componentes cliente.
// Con SUPABASE_APP_TOKEN usa el rol de base de datos acotado `app_servidor` (migración 0030, ver README): sin acceso a auth ni storage,
// sin borrar y sin escribir directo en lo crítico. Sin el token usa service_role (todo el acceso): es el modo de antes.
export const db = tokenApp
  ? createClient<Database>(url, process.env.SUPABASE_ANON_KEY ?? faltaAnon(), { ...opciones, global: { headers: { Authorization: `Bearer ${tokenApp}` } } })
  : createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opciones);

function faltaAnon(): never {
  throw new Error("SUPABASE_ANON_KEY es obligatoria cuando se usa SUPABASE_APP_TOKEN (la clave anon es pública)");
}
