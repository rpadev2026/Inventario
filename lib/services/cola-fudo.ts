/**
 * Cola de la sincronización de ventas de Fudo, sin saber de Supabase ni de Fudo: recibe la cola y la sincronización como
 * dependencias para probarla con falsos (`cola-fudo.test.ts`); `trabajo-fudo.ts` conecta las reales. Sin `server-only`: la pantalla
 * importa los tipos.
 */
import type { ResumenSincronizacion } from "./sincronizar-ventas";

/** Estados del trabajo (columna `"Estado"` de `"TrabajosFudo"`). */
export const TRABAJO = { pendiente: 0, procesando: 1, listo: 2, error: 3 } as const;
/** Resumen del trabajo: el avance mientras corre (con `total` de ventas por revisar) y el resultado al terminar. */
export type AvanceTrabajo = Partial<ResumenSincronizacion> & { total?: number };
export type TrabajoFudo = {
  IdTrabajo: number; Estado: number; Origen: string; FechaCreacion: string; FechaInicio: string | null; FechaFin: string | null;
  Resumen: AvanceTrabajo | null; Error: string | null;
};
export type EstadoTrabajos = { actual: TrabajoFudo | null; ultimo: TrabajoFudo | null };

export type ColaFudo = {
  /** Toma el trabajo pendiente (o uno abandonado por un proceso que murió); null si no hay. */
  reclamar(): Promise<{ id: number } | null>;
  /** Señal de vida y avance del trabajo en curso. */
  avance(id: number, avance: AvanceTrabajo): Promise<void>;
  /** Cierra el trabajo: con `error` queda fallido; sin él, listo con su resumen. */
  terminar(id: number, resumen: AvanceTrabajo | null, error: string | null): Promise<void>;
};
export type Correr = (alAvanzar: (r: ResumenSincronizacion, total: number) => Promise<void>) => Promise<{ error?: string; resumen?: ResumenSincronizacion }>;

/** Cada cuánto, como máximo, se avisa el avance a la base (cada venta serían cientos de viajes de más). */
export const CADA_MS = 5000;

/**
 * Ejecuta el trabajo pendiente, si lo hay. Nunca lanza: lo que falle queda en el trabajo (estado «con error») para la pantalla.
 * Devuelve `ejecutado: false` si no había nada que hacer (otro proceso lo está corriendo, o no se pidió).
 */
export async function procesarTrabajoCon(cola: ColaFudo, correr: Correr, o: { ahora?: () => number; cadaMs?: number } = {}): Promise<{ ejecutado: boolean; error?: string; resumen?: ResumenSincronizacion }> {
  const ahora = o.ahora ?? Date.now, cadaMs = o.cadaMs ?? CADA_MS;
  let trabajo: { id: number } | null;
  try { trabajo = await cola.reclamar(); } catch (e) { console.error("[fudo] cola:", (e as Error).message); return { ejecutado: false, error: "No se pudo leer la cola" }; }
  if (!trabajo) return { ejecutado: false };
  const { id } = trabajo;
  let ultimo = ahora();
  const alAvanzar = async (r: ResumenSincronizacion, total: number) => {
    if (ahora() - ultimo < cadaMs) return;
    ultimo = ahora();
    try { await cola.avance(id, { ...r, total }); } catch (e) { console.error("[fudo] avance:", (e as Error).message); } // el avance es informativo: no frena la sincronización
  };
  let r: Awaited<ReturnType<Correr>>;
  try { r = await correr(alAvanzar); } catch (e) { r = { error: (e as Error).message }; }
  try {
    await cola.terminar(id, r.resumen ? { ...r.resumen, total: r.resumen.revisadas } : null, r.error ?? null);
  } catch (e) { console.error("[fudo] no se pudo cerrar el trabajo:", (e as Error).message); } // sin cierre, el latido vencido lo deja retomar
  return { ejecutado: true, ...r };
}
