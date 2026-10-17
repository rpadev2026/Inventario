import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
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
  if (token && process.env.SESSION_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET), { algorithms: ["HS256"] });
      valido = true;
    } catch {}
  }
  if (!valido && !PUBLICAS.includes(pathname)) return NextResponse.redirect(new URL("/login", req.url));
  // Filtros de los listados: fuera de la URL (ver lib/filtros-url.ts). Solo páginas (no /api ni /login) y peticiones GET.
  const filtrable = req.method === "GET" && valido && !pathname.startsWith("/api/") && pathname !== "/login";
  const f = filtrable ? resolverFiltros(pathname, req.nextUrl.search.slice(1), req.cookies.get(COOKIE_FILTROS)?.value) : null;
  if (f?.redirigir) {
    // Una precarga (prefetch) no puede guardar filtros: se rechaza y el clic real hace la petición verdadera.
    if (req.headers.get("next-router-prefetch") || req.headers.get("purpose") === "prefetch") return new NextResponse(null, { status: 204 });
    const destino = req.nextUrl.clone();
    destino.search = f.limpia;
    const r = NextResponse.redirect(destino);
    if (f.cookie) r.cookies.set(COOKIE_FILTROS, f.cookie, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    else r.cookies.delete(COOKIE_FILTROS);
    return r;
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = politica(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp); // Next lee el nonce de este encabezado para marcar sus scripts
  let res: NextResponse;
  if (f && f.efectiva !== f.limpia) {
    const url = req.nextUrl.clone();
    url.search = f.efectiva;
    res = NextResponse.rewrite(url, { request: { headers } });
  } else res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
