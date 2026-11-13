import { NextResponse, type NextRequest } from "next/server";
import { rechazarSiNoEsCron } from "@/lib/auth/cron";
import { cerrarCaducadas } from "@/lib/services/caducidad";

/**
 * Cierra las solicitudes aprobadas parcialmente que llevan 7 días o más y avisa a los participantes.
 * Lo llama un programador (cron) con `Authorization: Bearer <CRON_SECRET>`. Acepta GET además de POST porque los cron de Vercel llaman por GET.
 */
async function manejar(req: NextRequest) {
  return rechazarSiNoEsCron(req) ?? NextResponse.json(await cerrarCaducadas());
}
export const GET = manejar;
export const POST = manejar;
