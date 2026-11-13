/**
 * ¿Cambió la cantidad de algún producto respecto de lo SOLICITADO? Con cambio, la aprobación es PARCIAL (exige motivo);
 * sin cambio, es una aprobación normal. Se compara con lo pedido, no con el máximo que permite el stock: si el stock no alcanza,
 * la persona ya está aprobando menos de lo pedido. Un valor vacío o no numérico cuenta como 0.
 */
export function hayCambioDeCantidades(items: { producto: number; solicitada: number }[], vals: Record<string, string>): boolean {
  return items.some((i) => (Number(vals[String(i.producto)]) || 0) !== i.solicitada);
}
