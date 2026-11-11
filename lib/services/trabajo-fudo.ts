import "server-only";
import { after } from "next/server";
import { db, nulo } from "@/lib/db/supabase";
import { procesarTrabajoCon, type AvanceTrabajo, type ColaFudo, type EstadoTrabajos } from "./cola-fudo";
import { configuracionFaltante, sincronizarVentas } from "./ventas-fudo";
import type { Json } from "@/lib/db/tipos";

/** La cola real: las funciones SQL de la migración 0043 (la tabla `"TrabajosFudo"` solo se toca por ellas). */
const colaSupabase: ColaFudo = {
  async reclamar() {
    const { data, error } = await db.rpc("reclamar_trabajo_fudo");
    if (error) throw new Error(error.code ?? error.message);
    return data[0] ? { id: data[0].IdTrabajo } : null;
  },
  async avance(id, avance) {
    const { error } = await db.rpc("latido_trabajo_fudo", { p_id: id, p_avance: avance as Json });
    if (error) throw new Error(error.code ?? error.message);
  },
  async terminar(id, resumen, error) {
    const r = await db.rpc("terminar_trabajo_fudo", { p_id: id, p_resumen: (resumen as Json | null) ?? nulo, p_error: error ?? nulo });
    if (r.error) throw new Error(r.error.code ?? r.error.message);
  },
};

/** Corre el trabajo pendiente de sincronización (o retoma uno abandonado). Lo usan `after()` de la acción y el cron. */
export const procesarTrabajoFudo = () => procesarTrabajoCon(colaSupabase, (alAvanzar) => sincronizarVentas(alAvanzar));

/** Deja la sincronización en la cola y devuelve de inmediato; se ejecuta después de responder. Si ya hay una activa, no se duplica. */
export async function pedirSincronizacion(usuario: number | null, origen: "manual" | "cron", ejecutarDespues = true): Promise<{ error?: string; nuevo?: boolean }> {
  const falta = configuracionFaltante();
  if (falta) return { error: falta };
  const { data, error } = await db.rpc("encolar_trabajo_fudo", { p_usuario: usuario ?? nulo, p_origen: origen });
  if (error) { console.error("[fudo] no se pudo encolar:", error.code); return { error: "No se pudo iniciar la sincronización. Intente nuevamente." }; }
  if (ejecutarDespues) after(() => procesarTrabajoFudo()); // el cron lo ejecuta él mismo
  return { nuevo: (data as { nuevo: boolean }).nuevo };
}

/** El trabajo activo (pendiente o en curso) y el último terminado, para mostrar en la pantalla. */
export async function estadoTrabajoFudo(): Promise<EstadoTrabajos> {
  const { data, error } = await db.rpc("estado_trabajo_fudo");
  if (error) throw new Error("No se pudo leer el estado de la sincronización");
  return data as unknown as EstadoTrabajos;
}

export type { AvanceTrabajo };
