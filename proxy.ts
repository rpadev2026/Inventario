import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// /api/correos/procesar se autentica con CRON_SECRET (lo llama un programador, sin sesión).
const PUBLICAS = ["/login", "/api/correos/procesar"];

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
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
