import { paginar, type Paginacion } from "./paginacion";

/** Filtros del reporte de stock, leídos de la URL: lo que no tenga el formato esperado se ignora. */
export type FiltrosStock = { bodega?: number; q: string; soloConStock: boolean };

type Entrada = Record<string, string | string[] | undefined>;
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export function leerFiltrosStock(sp: Entrada): FiltrosStock {
  const b = texto(sp.bodega);
  return {
    bodega: b && /^\d{1,15}$/.test(b) ? Number(b) : undefined,
    q: (texto(sp.q) ?? "").trim().slice(0, 80),
    soloConStock: texto(sp.con_stock) === "1",
  };
}

/** Parámetros de URL de los filtros (sin vacíos), para enlazar el CSV con lo mismo que se ve en pantalla. */
export function paramsStock(f: FiltrosStock): string {
  const p = new URLSearchParams();
  if (f.bodega) p.set("bodega", String(f.bodega));
  if (f.q) p.set("q", f.q);
  if (f.soloConStock) p.set("con_stock", "1");
  return p.toString();
}

export type FilaStock = {
  idBodega: number; bodega: string; idProducto: number; codigo: string | null; producto: string;
  unidad: string; cantidad: number; costo: number | null; valor: number | null;
};
export type ReporteStock = {
  total: number; valorTotal: number; sinCosto: number;
  porBodega: { idBodega: number; bodega: string; filas: number; valor: number }[];
  filas: FilaStock[];
};

/** Página pedida (con el total ya conocido) para el listado en pantalla. */
export const paginaStock = (sp: Entrada, total: number): Paginacion => paginar({ pagina: texto(sp.pagina), tam: texto(sp.tam) }, total);
