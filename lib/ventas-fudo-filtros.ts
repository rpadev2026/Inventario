/** Filtros de la pantalla «Ventas de Fudo» (fecha de venta, producto y motivo), leídos de la URL. Sin `server-only`: lo usan la pantalla y la exportación. */
export const MOTIVOS = [{ valor: "sin receta", nombre: "Sin receta vinculada" }, { valor: "sin bodega", nombre: "La receta no tiene bodega" }] as const;
export type FiltrosVentasFudo = { desde: string; hasta: string; q: string; motivo: string };
type Entrada = Record<string, string | string[] | undefined>;
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Fecha real (no solo con la forma): «2026-02-31» no lo es. */
const esFecha = (v: string) => ISO.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** Lo inválido se ignora (queda vacío = sin filtro). Si las fechas vienen al revés se intercambian. */
export function leerFiltrosVentasFudo(sp: Entrada): FiltrosVentasFudo {
  let desde = texto(sp.desde).trim(), hasta = texto(sp.hasta).trim();
  if (!esFecha(desde)) desde = "";
  if (!esFecha(hasta)) hasta = "";
  if (desde && hasta && desde > hasta) [desde, hasta] = [hasta, desde];
  const motivo = texto(sp.motivo);
  return { desde, hasta, q: texto(sp.q).trim().slice(0, 80), motivo: MOTIVOS.some((m) => m.valor === motivo) ? motivo : "" };
}

export const hayFiltros = (f: FiltrosVentasFudo) => !!(f.desde || f.hasta || f.q || f.motivo);

/** Parámetros de los enlaces de exportación (solo los filtros con valor). */
export const paramsFiltros = (f: FiltrosVentasFudo, extra: Record<string, string> = {}) =>
  new URLSearchParams(Object.entries({ ...extra, ...f }).filter(([, v]) => v)).toString();
