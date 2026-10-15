import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { procesarCola } from "@/lib/services/correo";

/** Reintenta los correos pendientes. Lo llama un programador (cron) con `Authorization: Bearer <CRON_SECRET>`. */
export async function POST(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || secreto.length < 16) return NextResponse.json({ error: "No configurado" }, { status: 503 });
  const dado = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${secreto}`);
  if (dado.length !== esperado.length || !timingSafeEqual(dado, esperado)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json(await procesarCola(50));
}
