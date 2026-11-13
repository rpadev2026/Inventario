import "server-only";
import { db } from "@/lib/db/supabase";
import { MOTIVO_CADUCIDAD } from "@/lib/aprobacion-parcial";
import { avisarCierre } from "./cierre";

/**
 * Cierra las solicitudes «Aprobadas parcialmente» con 7 días o más (función SQL, idempotente y segura si corren dos a la vez) y avisa por
 * push y correo a sus participantes. Nunca lanza. Lo llama un cron (`/api/solicitudes/cerrar-caducadas`) y, de respaldo, el Inicio de quien gestiona.
 */
export async function cerrarCaducadas(): Promise<{ cerradas: number }> {
  try {
    const { data, error } = await db.rpc("cerrar_solicitudes_caducadas");
    if (error || !data) { console.error("[caducidad] no se pudo cerrar:", error?.message); return { cerradas: 0 }; }
    await Promise.allSettled(data.map((s) => avisarCierre({ id: s.IdSolicitud, numero: s.NumeroSolicitud, token: s.Token }, MOTIVO_CADUCIDAD)));
    return { cerradas: data.length };
  } catch (e) {
    console.error("[caducidad] error inesperado:", (e as Error).message);
    return { cerradas: 0 };
  }
}
