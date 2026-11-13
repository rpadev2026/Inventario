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
  const base = db.from("Solicitudes").select(COLUMNAS, { count: "exact" });
  const consulta = u.gestiona
    ? base.or(`EstadoSolicitud.in.(1,2,4),and(IdUsuarioSolicitante.eq.${u.uid},EstadoSolicitud.eq.0)`)
    : base.eq("IdUsuarioSolicitante", u.uid).in("EstadoSolicitud", [...ESTADOS_NO_FINALIZADOS]);
  // Quien gestiona recibe primero las Enviadas (estado 1, las que debe aprobar) y sus borradores: el tope no puede dejarlas fuera.
  const ordenada = u.gestiona ? consulta.order("EstadoSolicitud", { ascending: true }) : consulta;
  const { data, error, count } = await ordenada.order("IdSolicitud", { ascending: false }).limit(TOPE_CONSULTA);
  if (error || !data) {
    console.error("[bandeja] no se pudo leer:", error?.message);
    throw new Error(MENSAJE);
  }
  const filas: FilaSolicitud[] = data.map((r) => ({
    IdSolicitud: r.IdSolicitud, Token: r.Token, NumeroSolicitud: r.NumeroSolicitud, FechaSolicitud: r.FechaSolicitud,
    EstadoSolicitud: r.EstadoSolicitud, IdUsuarioSolicitante: r.IdUsuarioSolicitante,
    NombreBodega: r.Bodegas.NombreBodega, Solicitante: `${r.Usuarios.Nombres} ${r.Usuarios.Apellidos}`,
  }));
  const r = armarBandeja(filas, u);
  // Todo lo que la consulta devuelve es visible para el usuario: el conteo exacto es el total real aunque se hayan traído solo 200 filas.
  return { items: r.items, total: Math.max(r.total, count ?? 0) };
}
