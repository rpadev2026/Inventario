/**
 * Sincroniza las ventas cerradas de Fudo con el stock. Sin saber de Fudo ni de Supabase: recibe el origen de las ventas y el
 * repositorio como dependencias para probarlo con falsos (`sincronizar-ventas.test.ts`); `ventas-fudo.ts` conecta los reales.
 */
import type { VentaFudo } from "./fudo";

export type OrigenVentas = { ventasCerradas(desde: Date, hasta: Date): Promise<VentaFudo[]> };
export type RepoVentas = {
  /** Cierre de la última venta ya procesada (null si no hay ninguna). */
  ultimoCierre(): Promise<Date | null>;
  /** Procesa una venta (idempotente): `procesada` false = ya estaba; `omitidos` = líneas que no descontaron nada. */
  procesar(v: VentaFudo): Promise<{ procesada: boolean; omitidos: number }>;
};
export type ResumenSincronizacion = { revisadas: number; procesadas: number; yaProcesadas: number; lineasOmitidas: number; errores: string[] };

/** Se vuelve a leer desde un poco antes del último cierre por si una venta cerró tarde o falló antes; la base ignora las ya procesadas. */
export const SOLAPE_MS = 2 * 24 * 3600 * 1000;

export async function sincronizarVentasCon(origen: OrigenVentas, repo: RepoVentas, o: { desde: Date; ahora: Date }): Promise<ResumenSincronizacion> {
  const ultimo = await repo.ultimoCierre();
  const inicio = ultimo ? new Date(Math.max(o.desde.getTime(), ultimo.getTime() - SOLAPE_MS)) : o.desde;
  const resumen: ResumenSincronizacion = { revisadas: 0, procesadas: 0, yaProcesadas: 0, lineasOmitidas: 0, errores: [] };
  for (const v of await origen.ventasCerradas(inicio, o.ahora)) {
    resumen.revisadas++;
    try {
      const r = await repo.procesar(v);
      if (r.procesada) { resumen.procesadas++; resumen.lineasOmitidas += r.omitidos; } else resumen.yaProcesadas++;
    } catch (e) {
      // Una venta que falla no frena a las demás: queda para el próximo intento (mientras esté dentro del solape).
      resumen.errores.push(`Venta ${v.id}: ${(e as Error).message}`);
    }
  }
  return resumen;
}
