import { NextResponse, type NextRequest } from "next/server";
import { rechazarSiNoEsCron } from "@/lib/auth/cron";
import { sincronizarVentas } from "@/lib/services/ventas-fudo";

/** Trae las ventas cerradas de Fudo y descuenta el stock. Lo llama un programador (cron) con `Authorization: Bearer <CRON_SECRET>`. */
export async function POST(req: NextRequest) {
  const rechazo = rechazarSiNoEsCron(req);
  if (rechazo) return rechazo;
  const r = await sincronizarVentas();
  return NextResponse.json(r, { status: r.error ? 502 : 200 });
}
