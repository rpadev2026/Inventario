"use server";
import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/auth/session";
import { sincronizarVentas } from "@/lib/services/ventas-fudo";
import type { ResumenSincronizacion } from "@/lib/services/sincronizar-ventas";

/** Trae las ventas de Fudo y descuenta el stock ahora (solo Administrador; el cron usa /api/fudo/sincronizar). */
export async function sincronizarAhora(): Promise<{ error?: string; resumen?: ResumenSincronizacion }> {
  await requerirAdmin();
  const r = await sincronizarVentas();
  revalidatePath("/mantenedores/ventas-fudo");
  return r;
}
