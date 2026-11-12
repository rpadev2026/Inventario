import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./tipos";
import { conTimeout } from "../http-timeout";

/** Argumento NULL de una función SQL que lo acepta: los tipos generados no lo admiten en parámetros sin DEFAULT. */
export const nulo = null as never;

// Toda consulta a la base se corta a los 30 s: sin límite, una base lenta o inalcanzable deja la página colgada. (El `fetch` se lee en cada
// llamada, no al cargar el módulo, porque Next reemplaza el global.)
const fetchLimitado = conTimeout((entrada, init) => fetch(entrada, init), 30_000, "La base de datos");
const opciones = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchLimitado } };
const url = process.env.SUPABASE_URL!;
const tokenApp = process.env.SUPABASE_APP_TOKEN;

// Solo servidor. Nunca importar desde componentes cliente.
// Con SUPABASE_APP_TOKEN usa el rol de base de datos acotado `app_servidor` (migración 0030, ver README): sin acceso a auth ni storage,
// sin borrar y sin escribir directo en lo crítico. Sin el token usa service_role (todo el acceso): es el modo de antes.
export const db = tokenApp
  ? createClient<Database>(url, process.env.SUPABASE_ANON_KEY ?? faltaAnon(), { ...opciones, global: { ...opciones.global, headers: { Authorization: `Bearer ${tokenApp}` } } })
  : createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, opciones);

function faltaAnon(): never {
  throw new Error("SUPABASE_ANON_KEY es obligatoria cuando se usa SUPABASE_APP_TOKEN (la clave anon es pública)");
}
