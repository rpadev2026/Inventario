/** Forma de lo que devuelven los RPC de ventas de Fudo (migración 0044). */
export type EstadoLinea = "descontó" | "sin receta" | "sin bodega";
export type LineaVenta = { producto: string; nombre: string; cantidad: number; monto: number | null; receta: string | null; estado: EstadoLinea };
export type ConsumoVenta = { producto: string; bodega: string; cantidad: number; unidad: string };
export type VentaListada = { id: string; cierre: string; proceso: string; unidades: number; monto: number | null; lineas: LineaVenta[]; consumos: ConsumoVenta[] };
export type ListadoVentas = { total: number; filas: VentaListada[] };
/** Resumen de las ventas del filtro (monto con IVA); sin ventas todo es 0. */
export type ResumenVentas = { ventas: number; unidades: number; monto: number; productos: number; lineasSinMonto: number };
export type Faltante = { producto: string; nombre: string; motivo: string; cantidad: number };
export type ListadoFaltantes = { total: number; filas: Faltante[] };
export type FilaExportada = { venta: string; cierre: string; producto: string; nombre: string; cantidad: number; monto: number | null; receta: string | null; estado: EstadoLinea };
