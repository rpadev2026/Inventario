/**
 * Bandeja de solicitudes del Inicio: de las solicitudes que llegan de la base, decide cuáles ve cada usuario, qué se espera de él
 * y en qué orden. Lógica pura (sin base de datos): se prueba entera en `bandeja-solicitudes.test.ts`.
 *
 * Estados (`app/(app)/solicitudes/estados.ts`): 0 Creada, 1 Enviada, 2 Aprobada, 3 Recepcionada, 4 Recepción parcial, 5 Rechazada.
 * No finalizadas: 0, 1, 2 y 4.
 */
export const ESTADOS_NO_FINALIZADOS: readonly number[] = [0, 1, 2, 4];

export type FilaSolicitud = {
  IdSolicitud: number; Token: string; NumeroSolicitud: number; FechaSolicitud: string; EstadoSolicitud: number;
  IdUsuarioSolicitante: number; NombreBodega: string; Solicitante: string;
};
export type Espera = "Por aprobar" | "Por recepcionar" | "Borrador" | "En espera de aprobación" | "En seguimiento";
export type ItemBandeja = FilaSolicitud & { espera: Espera; propia: boolean; requiereAccion: boolean };

/** Qué se espera del usuario con esta solicitud, o null si no debe verla. */
function esperaPara(f: FilaSolicitud, propia: boolean, gestiona: boolean): Espera | null {
  if (!ESTADOS_NO_FINALIZADOS.includes(f.EstadoSolicitud)) return null;
  if (propia) return f.EstadoSolicitud === 0 ? "Borrador" : f.EstadoSolicitud === 1 ? "En espera de aprobación" : "Por recepcionar";
  if (!gestiona || f.EstadoSolicitud === 0) return null; // un solicitante no ve ajenas; los borradores ajenos no los ve nadie
  return f.EstadoSolicitud === 1 ? "Por aprobar" : "En seguimiento";
}

const PIDEN_ACCION: readonly Espera[] = ["Por aprobar", "Por recepcionar"];

/**
 * Filtra por usuario, clasifica y ordena (primero lo que pide su acción; después la más reciente y, a igual fecha, el mayor id)
 * y recorta a `limite`. `total` es la cantidad real antes de recortar.
 */
export function armarBandeja(filas: FilaSolicitud[], u: { uid: number; gestiona: boolean }, limite = 10): { items: ItemBandeja[]; total: number } {
  const visibles: ItemBandeja[] = [];
  for (const f of filas) {
    const propia = f.IdUsuarioSolicitante === u.uid;
    const espera = esperaPara(f, propia, u.gestiona);
    if (espera) visibles.push({ ...f, espera, propia, requiereAccion: PIDEN_ACCION.includes(espera) });
  }
  visibles.sort((a, b) =>
    Number(b.requiereAccion) - Number(a.requiereAccion) || Date.parse(b.FechaSolicitud) - Date.parse(a.FechaSolicitud) || b.IdSolicitud - a.IdSolicitud);
  return { items: visibles.slice(0, limite), total: visibles.length };
}
