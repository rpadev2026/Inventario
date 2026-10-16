import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/** Valida `Authorization: Bearer <CRON_SECRET>` de las rutas que llama un programador (cron). Devuelve la respuesta de rechazo, o null si está autorizado. */
export function rechazarSiNoEsCron(req: NextRequest): NextResponse | null {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || secreto.length < 16) return NextResponse.json({ error: "No configurado" }, { status: 503 });
  const dado = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${secreto}`);
  if (dado.length !== esperado.length || !timingSafeEqual(dado, esperado)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return null;
}
