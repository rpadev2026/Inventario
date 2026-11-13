import { NextResponse, type NextRequest } from "next/server";
import { rechazarSiNoEsCron } from "@/lib/auth/cron";
import { pedirSincronizacion, procesarTrabajoFudo } from "@/lib/services/trabajo-fudo";

/**
 * Sincroniza las ventas cerradas de Fudo con el stock. Lo llama un programador (cron) con `Authorization: Bearer <CRON_SECRET>`.
 * Encola el trabajo y lo ejecuta en esta misma petición (el cron ES el segundo plano); también retoma uno abandonado por un proceso
 * que murió. Si ya hay una sincronización corriendo bien, responde 202 sin duplicarla.
 * Acepta GET además de POST porque los cron de Vercel llaman por GET.
 */
async function manejar(req: NextRequest) {
  const rechazo = rechazarSiNoEsCron(req);
  if (rechazo) return rechazo;
  const p = await pedirSincronizacion(null, "cron", false);
  if (p.error) return NextResponse.json({ error: p.error }, { status: 502 });
  const r = await procesarTrabajoFudo();
  if (!r.ejecutado) return NextResponse.json({ enSegundoPlano: true }, { status: 202 });
  return NextResponse.json({ error: r.error, resumen: r.resumen }, { status: r.error ? 502 : 200 });
}
export const GET = manejar;
export const POST = manejar;
