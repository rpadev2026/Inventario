import { NextResponse, type NextRequest } from "next/server";
import { rechazarSiNoEsCron } from "@/lib/auth/cron";
import { procesarCola } from "@/lib/services/correo";

/**
 * Reintenta los correos pendientes. Lo llama un programador (cron) con `Authorization: Bearer <CRON_SECRET>`.
 * Acepta GET además de POST porque los cron de Vercel llaman por GET.
 */
async function manejar(req: NextRequest) {
  return rechazarSiNoEsCron(req) ?? NextResponse.json(await procesarCola(50));
}
export const GET = manejar;
export const POST = manejar;
