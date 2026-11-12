import { leerSesion } from "@/lib/auth/session";

/**
 * Latido de actividad: el navegador lo llama mientras el usuario está activo (mouse, teclado, scroll o toque). Al pasar por `proxy.ts`
 * renueva la marca de última actividad del token; aquí además se revalida la sesión contra la base (un usuario desactivado o una
 * clave cambiada se enteran en el acto). 204 = sigue vigente; 401 = la sesión ya no vale.
 */
export async function POST() {
  const s = await leerSesion();
  return new Response(null, { status: s ? 204 : 401, headers: { "Cache-Control": "no-store" } });
}
