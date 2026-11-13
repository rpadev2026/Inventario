import "server-only";
import { db } from "@/lib/db/supabase";
import { armarBandeja, ESTADOS_NO_FINALIZADOS, type FilaSolicitud, type ItemBandeja } from "@/lib/bandeja-solicitudes";

const MENSAJE = "No se pudo cargar la bandeja de solicitudes";
const TOPE_CONSULTA = 200; // la bandeja muestra 10: la consulta no necesita traer todo el historial

// El nombre de la FK hacia Usuarios es obligatorio: Solicitudes tiene varias (ver CLAUDE.md).
const COLUMNAS = "IdSolicitud,Token,NumeroSolicitud,FechaSolicitud,EstadoSolicitud,IdUsuarioSolicitante,Bodegas!inner(NombreBodega),Usuarios!Solicitudes_IdUsuarioSolicitante_fkey!inner(Nombres,Apellidos)";

/**
 * Las solicitudes no finalizadas que debe ver este usuario, clasificadas y ordenadas (ver `armarBandeja`).
 * Solicitante: solo las suyas. Quien gestiona: las Enviadas, Aprobadas y Parciales de todos, y solo sus propios borradores.
 */
export async function cargarBandeja(u: { uid: number; gestiona: boolean }): Promise<{ items: ItemBandeja[]; total: number }> {
  // El uid va dentro de un filtro de texto (.or): se exige un entero positivo antes de usarlo.
  if (!Number.isInteger(u.uid) || u.uid <= 0) throw new Error(MENSAJE);
  const base = db.from("Solicitudes").select(COLUMNAS);
  const consulta = u.gestiona
    ? base.or(`EstadoSolicitud.in.(1,2,4),and(IdUsuarioSolicitante.eq.${u.uid},EstadoSolicitud.eq.0)`)
    : base.eq("IdUsuarioSolicitante", u.uid).in("EstadoSolicitud", [...ESTADOS_NO_FINALIZADOS]);
  const { data, error } = await consulta.order("IdSolicitud", { ascending: false }).limit(TOPE_CONSULTA);
  if (error || !data) {
    console.error("[bandeja] no se pudo leer:", error?.message);
    throw new Error(MENSAJE);
  }
  const filas: FilaSolicitud[] = data.map((r) => ({
    IdSolicitud: r.IdSolicitud, Token: r.Token, NumeroSolicitud: r.NumeroSolicitud, FechaSolicitud: r.FechaSolicitud,
    EstadoSolicitud: r.EstadoSolicitud, IdUsuarioSolicitante: r.IdUsuarioSolicitante,
    NombreBodega: r.Bodegas.NombreBodega, Solicitante: `${r.Usuarios.Nombres} ${r.Usuarios.Apellidos}`,
  }));
  return armarBandeja(filas, u);
}
