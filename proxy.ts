import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { inactiva, minutosInactividad, REFRESCO_MS } from "@/lib/auth/inactividad";
import { COOKIE_FILTROS, resolverFiltros } from "@/lib/filtros-url";

// /api/correos/procesar se autentica con CRON_SECRET (lo llama un programador, sin sesión).
const PUBLICAS = ["/login", "/api/correos/procesar", "/api/fudo/sincronizar"];

/** CSP con nonce por petición: solo se ejecutan los scripts que Next marca con él ('strict-dynamic' cubre los que estos cargan). */
function politica(nonce: string): string {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'` + (dev ? " 'unsafe-eval'" : ""),
    // Los estilos en línea (atributos style de React) no admiten nonce: se mantiene 'unsafe-inline' solo aquí.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join("; ");
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("sesion")?.value;
  let valido = false;
  let porInactividad = false;
  let renovado: { token: string; segundos: number } | null = null;
  if (token && process.env.SESSION_SECRET) {
    try {
      const clave = new TextEncoder().encode(process.env.SESSION_SECRET);
      const { payload } = await jwtVerify(token, clave, { algorithms: ["HS256"] });
      const ahora = Date.now();
      // Última actividad: la del token; los emitidos antes de existir esta marca cuentan desde que se emitieron.
      const la = typeof payload.la === "number" ? payload.la : (payload.iat ?? 0) * 1000;
      if (inactiva(la, ahora, minutosInactividad(process.env.SESSION_IDLE_MINUTES))) porInactividad = true;
      else {
        valido = true;
        // Sesión deslizante: cada petición válida renueva la marca (el vencimiento absoluto de 8 h no cambia).
        if (ahora - la > REFRESCO_MS) {
          renovado = {
            token: await new SignJWT({ ...payload, la: ahora }).setProtectedHeader({ alg: "HS256" }).sign(clave),
            segundos: Math.max(1, (payload.exp ?? 0) - Math.floor(ahora / 1000)),
          };
        }
      }
    } catch {}
  }
  if (!valido && !PUBLICAS.includes(pathname)) {
    const r = NextResponse.redirect(new URL(porInactividad ? "/login?cierre=inactividad" : "/login", req.url));
    if (porInactividad) { r.cookies.delete("sesion"); r.cookies.delete(COOKIE_FILTROS); }
    return r;
  }
  // Filtros de los listados: fuera de la URL (ver lib/filtros-url.ts). Solo páginas (no /api ni /login) y peticiones GET.
  const filtrable = req.method === "GET" && valido && !pathname.startsWith("/api/") && pathname !== "/login";
  const f = filtrable ? resolverFiltros(pathname, req.nextUrl.search.slice(1), req.cookies.get(COOKIE_FILTROS)?.value) : null;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = politica(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp); // Next lee el nonce de este encabezado para marcar sus scripts
  let res: NextResponse;
  // La página recibe los filtros de la URL combinados con los guardados (la URL visible la limpia el navegador, sin redirigir).
  if (f && f.efectiva !== req.nextUrl.search.slice(1)) {
    const url = req.nextUrl.clone();
    url.search = f.efectiva;
    res = NextResponse.rewrite(url, { request: { headers } });
  } else res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  if (porInactividad) { res.cookies.delete("sesion"); res.cookies.delete(COOKIE_FILTROS); } // token vencido por inactividad: no se deja una copia inútil en el navegador
  if (renovado) res.cookies.set("sesion", renovado.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: renovado.segundos });
  // Una precarga (prefetch) no cambia lo guardado: solo el clic real lo hace.
  const precarga = req.headers.get("next-router-prefetch") || req.headers.get("purpose") === "prefetch";
  if (f && f.cookie !== undefined && !precarga) {
    if (f.cookie) res.cookies.set(COOKIE_FILTROS, f.cookie, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    else res.cookies.delete(COOKIE_FILTROS);
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
