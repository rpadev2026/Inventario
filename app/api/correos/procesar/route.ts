import { NextResponse, type NextRequest } from "next/server";
import { rechazarSiNoEsCron } from "@/lib/auth/cron";
import { procesarCola } from "@/lib/services/correo";

/** Reintenta los correos pendientes. Lo llama un programador (cron) con `Authorization: Bearer <CRON_SECRET>`. */
export async function POST(req: NextRequest) {
  return rechazarSiNoEsCron(req) ?? NextResponse.json(await procesarCola(50));
}
