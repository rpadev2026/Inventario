import type { LineaDte } from "@/lib/services/bsale";
import type { UnidadInfo } from "@/lib/unidades";
import { IVA_FACTOR } from "@/lib/factura-calculo";

export type ProductoCandidato = { id: number; codigo: string | null; nombre: string; unidadBase: string };
/** Línea lista para el formulario de factura (los mismos textos que escribiría el usuario). */
export type LineaFactura = { producto: string; unidad: string; precio: string; cantidad: string };

const mayus = (s: string) => s.trim().toUpperCase();

/**
 * Cruza las líneas del DTE con los productos: por código o, si no, por nombre exacto (sin distinguir mayúsculas). La unidad del DTE debe
 * ser una unidad de la misma familia que la base del producto (por código o nombre); si no, la línea queda sin cruzar y se ingresa a mano
 * (adivinar la unidad descontaría mal el stock). El precio sale del monto neto de la línea (con descuento) más IVA, salvo líneas exentas.
 */
export function lineasDesdeDte(lineas: LineaDte[], productos: ProductoCandidato[], unidades: UnidadInfo[]): { lineas: LineaFactura[]; sinCruzar: LineaDte[] } {
  const porCodigo = new Map(productos.filter((p) => p.codigo).map((p) => [mayus(p.codigo!), p]));
  const porNombre = new Map(productos.map((p) => [mayus(p.nombre), p]));
  const cruzadas: LineaFactura[] = [], sinCruzar: LineaDte[] = [];
  for (const l of lineas) {
    const p = (l.codigo && porCodigo.get(mayus(l.codigo))) || porNombre.get(mayus(l.nombre));
    const u = p && l.unidad ? unidades.find((x) => x.IdEstado === 1 && x.UnidadBase === p.unidadBase && (mayus(x.Codigo) === mayus(l.unidad) || mayus(x.Nombre) === mayus(l.unidad))) : undefined;
    if (!p || !u) { sinCruzar.push(l); continue; }
    const conIva = l.montoNeto * (l.exento ? 1 : IVA_FACTOR);
    cruzadas.push({ producto: String(p.id), unidad: u.Codigo, precio: String(Math.round((conIva / l.cantidad) * 100) / 100), cantidad: String(Math.round(l.cantidad * 1000) / 1000) });
  }
  return { lineas: cruzadas, sinCruzar };
}
