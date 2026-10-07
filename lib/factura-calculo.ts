export type LineaFactura = { precio: number; cantidad: number };

const IVA_FACTOR = 1.19;

/**
 * Totales de una factura cuyos precios de línea YA incluyen IVA: el total es la suma de las líneas,
 * el neto es total / 1,19 y el IVA es la diferencia (así neto + IVA siempre igualan al total).
 */
export function calcularTotales(lineas: LineaFactura[]): { total: number; neto: number; iva: number } {
  const suma = lineas.reduce((a, l) => {
    const t = l.precio * l.cantidad;
    return Number.isFinite(t) ? a + Math.round(t * 100) / 100 : a;
  }, 0);
  const total = Math.round(suma);
  const neto = Math.round(total / IVA_FACTOR);
  return { total, neto, iva: total - neto };
}
