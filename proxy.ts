import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// /api/correos/procesar se autentica con CRON_SECRET (lo llama un programador, sin sesión).
const PUBLICAS = ["/login", "/api/correos/procesar"];

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
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = politica(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp); // Next lee el nonce de este encabezado para marcar sus scripts
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
