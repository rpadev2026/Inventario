/**
 * Bandeja de solicitudes del Inicio: de las solicitudes que llegan de la base, decide cuáles ve cada usuario, qué se espera de él
 * y en qué orden. Lógica pura (sin base de datos): se prueba entera en `bandeja-solicitudes.test.ts`.
 *
 * Estados (`app/(app)/solicitudes/estados.ts`): 0 Creada, 1 Enviada, 2 Aprobada, 3 Recepcionada, 4 Recepción parcial, 5 Rechazada.
 * No finalizadas: 0, 1, 2 y 4. Además, la solicitud RECHAZADA propia se muestra `DIAS_RECHAZADA` días desde el rechazo, con su motivo.
 */
export const ESTADOS_NO_FINALIZADOS: readonly number[] = [0, 1, 2, 4];
/** Cuántos días permanece en la bandeja del solicitante una solicitud rechazada (así alcanza a leer el motivo). */
export const DIAS_RECHAZADA = 7;

export type FilaSolicitud = {
  IdSolicitud: number; Token: string; NumeroSolicitud: number; FechaSolicitud: string; EstadoSolicitud: number;
  IdUsuarioSolicitante: number; NombreBodega: string; Solicitante: string;
  /** Solo en las rechazadas (null en las anteriores a la migración 0048) y fecha en que se rechazó (`FechaAprobacion`). */
  MotivoRechazo: string | null; FechaResolucion: string | null;
};
export type Espera = "Por aprobar" | "Por recepcionar" | "Borrador" | "En espera de aprobación" | "En seguimiento" | "Rechazada";
export type ItemBandeja = FilaSolicitud & { espera: Espera; propia: boolean; requiereAccion: boolean };

/** Qué se espera del usuario con esta solicitud, o null si no debe verla. */
function esperaPara(f: FilaSolicitud, propia: boolean, gestiona: boolean, ahora: Date): Espera | null {
  if (f.EstadoSolicitud === 5) return propia && rechazadaReciente(f, ahora) ? "Rechazada" : null; // la rechazada ajena no la ve nadie
  if (!ESTADOS_NO_FINALIZADOS.includes(f.EstadoSolicitud)) return null;
  if (propia) return f.EstadoSolicitud === 0 ? "Borrador" : f.EstadoSolicitud === 1 ? "En espera de aprobación" : "Por recepcionar";
  if (!gestiona || f.EstadoSolicitud === 0) return null; // un solicitante no ve ajenas; los borradores ajenos no los ve nadie
  return f.EstadoSolicitud === 1 ? "Por aprobar" : "En seguimiento";
}

const MS_RECHAZADA = DIAS_RECHAZADA * 24 * 3600_000;
/** Rechazada hace menos de `DIAS_RECHAZADA` días. Sin fecha válida (rechazadas antiguas) no se considera reciente. */
function rechazadaReciente(f: FilaSolicitud, ahora: Date): boolean {
  const t = f.FechaResolucion ? Date.parse(f.FechaResolucion) : Number.NaN;
  return Number.isFinite(t) && ahora.getTime() - t < MS_RECHAZADA;
}

const PIDEN_ACCION: readonly Espera[] = ["Por aprobar", "Por recepcionar"];

/**
 * Filtra por usuario, clasifica y ordena (primero lo que pide su acción; después la más reciente y, a igual fecha, el mayor id)
 * y recorta a `limite`. `ahora` se inyecta para probar la ventana de las rechazadas. `total` es la cantidad real antes de recortar.
 */
export function armarBandeja(filas: FilaSolicitud[], u: { uid: number; gestiona: boolean }, limite = 10, ahora: Date = new Date()): { items: ItemBandeja[]; total: number } {
  const visibles: ItemBandeja[] = [];
  for (const f of filas) {
    const propia = f.IdUsuarioSolicitante === u.uid;
    const espera = esperaPara(f, propia, u.gestiona, ahora);
    if (espera) visibles.push({ ...f, espera, propia, requiereAccion: PIDEN_ACCION.includes(espera) });
  }
  visibles.sort((a, b) =>
    Number(b.requiereAccion) - Number(a.requiereAccion) || Date.parse(b.FechaSolicitud) - Date.parse(a.FechaSolicitud) || b.IdSolicitud - a.IdSolicitud);
  return { items: visibles.slice(0, limite), total: visibles.length };
}
