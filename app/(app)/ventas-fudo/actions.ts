"use server";
import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/auth/session";
import { pedirSincronizacion } from "@/lib/services/trabajo-fudo";

/** Pide la sincronización de ventas de Fudo y responde al tiro: corre en segundo plano (cola de trabajos). Solo Administrador; el cron usa /api/fudo/sincronizar. */
export async function sincronizarAhora(): Promise<{ error?: string; nuevo?: boolean }> {
  const s = await requerirAdmin();
  const r = await pedirSincronizacion(s.uid, "manual");
  revalidatePath("/ventas-fudo");
  return r;
}
