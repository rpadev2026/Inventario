import { paginar, type Paginacion } from "./paginacion";

/** Filtros de los reportes de ventas, leídos de la URL: fechas de Chile (AAAA-MM-DD), agrupación y texto. */
export type Agrupacion = "dia" | "semana" | "mes";
export type Rango = { desde: string; hasta: string };
type Entrada = Record<string, string | string[] | undefined>;
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const aUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const aIso = (d: Date) => d.toISOString().slice(0, 10);
/** Fecha real (no solo con la forma): «2026-02-31» no lo es. */
const esFecha = (v: string | undefined): v is string => !!v && ISO.test(v) && aIso(aUtc(v)) === v;

/** Hoy en Chile (AAAA-MM-DD). */
export const hoyChile = (ahora = new Date()) => ahora.toLocaleDateString("sv-SE", { timeZone: "America/Santiago" });
export const sumarDias = (iso: string, n: number) => aIso(new Date(aUtc(iso).getTime() + n * 86_400_000));

/** Rango pedido; lo inválido o ausente toma los últimos 30 días (hasta hoy) y si vienen al revés se intercambian. */
export function leerRango(sp: Entrada, ahora = new Date()): Rango {
  const hoy = hoyChile(ahora);
  const hasta = esFecha(texto(sp.hasta)) ? texto(sp.hasta)! : hoy;
  const desde = esFecha(texto(sp.desde)) ? texto(sp.desde)! : sumarDias(hasta, -29);
  return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde };
}

export const leerAgrupacion = (sp: Entrada): Agrupacion => (["dia", "semana", "mes"] as const).find((a) => a === texto(sp.agrupar)) ?? "dia";

export const paramsRango = (r: Rango, extra: Record<string, string | undefined> = {}) =>
  new URLSearchParams(Object.entries({ desde: r.desde, hasta: r.hasta, ...extra }).filter(([, v]) => v) as [string, string][]).toString();

/** Atajos de rango («Hoy», «Últimos 7 días», «Este mes», «Mes anterior»...). */
export function atajos(ahora = new Date()): { nombre: string; rango: Rango }[] {
  const hoy = hoyChile(ahora);
  const inicioMes = `${hoy.slice(0, 8)}01`;
  const finMesAnterior = sumarDias(inicioMes, -1);
  return [
    { nombre: "Hoy", rango: { desde: hoy, hasta: hoy } },
    { nombre: "Últimos 7 días", rango: { desde: sumarDias(hoy, -6), hasta: hoy } },
    { nombre: "Últimos 30 días", rango: { desde: sumarDias(hoy, -29), hasta: hoy } },
    { nombre: "Este mes", rango: { desde: inicioMes, hasta: hoy } },
    { nombre: "Mes anterior", rango: { desde: `${finMesAnterior.slice(0, 8)}01`, hasta: finMesAnterior } },
  ];
}

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => aUtc(iso).toLocaleDateString("es-CL", { timeZone: "UTC", ...o });
/** Texto del período: «lun 05-10-2026», «Semana 05-10-2026 al 11-10-2026» o «octubre de 2026». */
export function etiquetaPeriodo(iso: string, a: Agrupacion): string {
  if (a === "dia") return `${fmt(iso, { weekday: "short" }).replace(".", "")} ${fmt(iso, { day: "2-digit", month: "2-digit", year: "numeric" }).replaceAll("/", "-")}`;
  if (a === "semana") return `Semana ${fmt(iso, { day: "2-digit", month: "2-digit", year: "numeric" }).replaceAll("/", "-")} al ${fmt(sumarDias(iso, 6), { day: "2-digit", month: "2-digit", year: "numeric" }).replaceAll("/", "-")}`;
  return fmt(iso, { month: "long", year: "numeric" });
}

export type FilaVentaProducto = { idProductoFudo: string; producto: string; unidades: number; monto: number | null; ventas: number; sinMonto: number; receta: string | null };
export type ReporteVentasProducto = { total: number; ventas: number; unidades: number; monto: number; lineasSinMonto: number; filas: FilaVentaProducto[] };
export type FilaVentaPeriodo = { periodo: string; ventas: number; unidades: number; monto: number };
export type ReporteVentasPeriodo = { ventas: number; unidades: number; monto: number; lineasSinMonto: number; filas: FilaVentaPeriodo[] };

export const paginaVentas = (sp: Entrada, total: number): Paginacion => paginar({ pagina: texto(sp.pagina), tam: texto(sp.tam) }, total);
