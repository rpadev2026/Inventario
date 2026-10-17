import "server-only";
import { db, nulo } from "@/lib/db/supabase";
import { paginar, type Paginacion } from "@/lib/paginacion";
import type { FiltrosStock, ReporteStock } from "@/lib/reporte-stock";

const INT_MAX = 2_000_000_000; // el desplazamiento de la RPC es un int de Postgres

async function pedirStock(f: FiltrosStock, off: number, lim: number): Promise<ReporteStock> {
  const { data, error } = await db.rpc("reporte_stock", {
    p_bodega: f.bodega ?? nulo, p_q: f.q, p_solo_con_stock: f.soloConStock, p_off: Math.min(off, INT_MAX), p_lim: lim,
  });
  if (error || !data) throw new Error("No se pudo generar el reporte de stock");
  return data as unknown as ReporteStock;
}

/** Una página del reporte de stock valorizado; los totales son los de todo el filtro. */
export async function stockPagina(f: FiltrosStock, entrada: { pagina?: unknown; tam?: unknown }): Promise<{ reporte: ReporteStock; pg: Paginacion }> {
  // Primero la página pedida; si cae fuera del total (p. ej. filtro nuevo) se corrige y se vuelve a pedir.
  const tentativa = paginar(entrada, Number.MAX_SAFE_INTEGER);
  let reporte = await pedirStock(f, tentativa.from, tentativa.tam);
  const pg = paginar(entrada, Number(reporte.total));
  if (pg.from !== tentativa.from) reporte = await pedirStock(f, pg.from, pg.tam);
  return { reporte, pg };
}

/** Todas las filas del filtro (para el CSV), con un tope. */
export async function stockCompleto(f: FiltrosStock): Promise<ReporteStock> {
  return pedirStock(f, 0, 100000);
}
