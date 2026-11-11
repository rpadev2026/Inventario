import "server-only";
import { db } from "@/lib/db/supabase";
import { paginar, type Paginacion } from "@/lib/paginacion";
import type { FiltrosVentasFudo } from "@/lib/ventas-fudo-filtros";
import type { FilaExportada, ListadoFaltantes, ListadoVentas, ResumenVentas } from "@/lib/ventas-fudo-tipos";

const INT_MAX = 2_000_000_000; // el desplazamiento de la RPC es un int de Postgres
// Las fechas vacías van como null (sin límite); los tipos generados no admiten null en argumentos sin DEFAULT, de ahí el `as never`.
const args = (f: FiltrosVentasFudo) => ({ p_desde: (f.desde || null) as never, p_hasta: (f.hasta || null) as never, p_q: f.q, p_motivo: f.motivo });

/** Totales de las ventas que cumplen los mismos filtros que las tablas (0 si no hay ninguna). */
export async function resumenVentas(f: FiltrosVentasFudo): Promise<ResumenVentas> {
  const { data, error } = await db.rpc("resumen_ventas_fudo", args(f));
  if (error || !data) throw new Error("No se pudo calcular el resumen de ventas");
  return data as unknown as ResumenVentas;
}

/** Una página de las ventas descontadas con su detalle; el total es el de todo el filtro. */
export async function ventasListado(f: FiltrosVentasFudo, entrada: { pagina?: unknown; tam?: unknown }): Promise<{ listado: ListadoVentas; pg: Paginacion }> {
  const pedir = async (off: number, lim: number) => {
    const { data, error } = await db.rpc("listar_ventas_fudo", { ...args(f), p_off: Math.min(off, INT_MAX), p_lim: lim });
    if (error || !data) throw new Error("No se pudieron cargar las ventas");
    return data as unknown as ListadoVentas;
  };
  // Primero la página pedida; si cae fuera del total (p. ej. un filtro nuevo) se corrige y se vuelve a pedir.
  const tentativa = paginar(entrada, Number.MAX_SAFE_INTEGER);
  let listado = await pedir(tentativa.from, tentativa.tam);
  const pg = paginar(entrada, Number(listado.total));
  if (pg.from !== tentativa.from) listado = await pedir(pg.from, pg.tam);
  return { listado, pg };
}

async function pedirFaltantes(f: FiltrosVentasFudo, off: number, lim: number): Promise<ListadoFaltantes> {
  const { data, error } = await db.rpc("faltantes_ventas_fudo", { ...args(f), p_off: Math.min(off, INT_MAX), p_lim: lim });
  if (error || !data) throw new Error("No se pudo cargar lo vendido sin descontar");
  return data as unknown as ListadoFaltantes;
}

/** Una página de lo vendido sin descontar stock, sumado por producto de Fudo. */
export async function faltantesListado(f: FiltrosVentasFudo, entrada: { pagina?: unknown; tam?: unknown }): Promise<{ listado: ListadoFaltantes; pg: Paginacion }> {
  const tentativa = paginar(entrada, Number.MAX_SAFE_INTEGER);
  let listado = await pedirFaltantes(f, tentativa.from, tentativa.tam);
  const pg = paginar(entrada, Number(listado.total));
  if (pg.from !== tentativa.from) listado = await pedirFaltantes(f, pg.from, pg.tam);
  return { listado, pg };
}

/** Todo lo vendido sin descontar del filtro (para exportar). */
export const faltantesCompleto = (f: FiltrosVentasFudo) => pedirFaltantes(f, 0, 100000);

/** Una fila por línea vendida de las ventas del filtro (para exportar); `truncado` si pasa de 50.000. */
export async function ventasExportables(f: FiltrosVentasFudo): Promise<{ truncado: boolean; filas: FilaExportada[] }> {
  const { data, error } = await db.rpc("exportar_ventas_fudo", args(f));
  if (error || !data) throw new Error("No se pudieron exportar las ventas");
  return data as unknown as { truncado: boolean; filas: FilaExportada[] };
}
