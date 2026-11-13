import "server-only";
import { db } from "@/lib/db/supabase";
import { notificarCierre } from "./correo";
import { notificarPushCierre } from "./push";

/**
 * Avisa por correo y push a los participantes de una solicitud que acaba de cerrarse (solicitante, quienes intervinieron y Administradores).
 * Nunca lanza: un fallo de aviso no debe afectar al cierre, que ya quedó hecho.
 */
export async function avisarCierre(sol: { id: number; numero: number; token: string }, motivo: string): Promise<void> {
  try {
    const { data, error } = await db.rpc("participantes_solicitud", { p_solicitud: sol.id });
    if (error || !data) { console.error("[cierre] no se pudieron leer los participantes:", error?.message); return; }
    const correos = data.map((p) => p.Correo);
    const ids = data.map((p) => p.IdUsuario);
    // Cada canal por separado: si uno falla, el otro igual sale.
    await Promise.allSettled([notificarCierre(sol.numero, correos, motivo), notificarPushCierre(sol.numero, sol.token, motivo, ids)]);
  } catch (e) {
    console.error("[cierre] error inesperado:", (e as Error).message);
  }
}
