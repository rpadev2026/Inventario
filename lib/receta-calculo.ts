/** Una línea de receta ya resuelta: `factorUnidad` lleva su unidad a la unidad base y `costoPorBase` es el costo por unidad base del ingrediente. */
export type LineaCalculo = { cantidad: number; porcion: number; merma: number; factorUnidad: number; costoPorBase: number | null };

const redondear2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Misma fórmula que `calcular_receta`: bruto = cantidad × porción × (1 + merma); costo = bruto × factor × costo base (2 decimales). */
export function calcularLinea(l: LineaCalculo): { bruto: number; costo: number | null } {
  const bruto = l.cantidad * l.porcion * (1 + l.merma);
  return { bruto, costo: l.costoPorBase === null ? null : redondear2(bruto * l.factorUnidad * l.costoPorBase) };
}

/** Total (solo líneas con costo), costo por porción y si falta el costo de algún ingrediente. */
export function calcularReceta(lineas: LineaCalculo[], porciones: number): { total: number; porcion: number; incompleto: boolean } {
  let total = 0;
  let incompleto = false;
  for (const l of lineas) {
    const { costo } = calcularLinea(l);
    if (costo === null) incompleto = true; else total += costo;
  }
  return { total: redondear2(total), porcion: porciones > 0 ? redondear2(total / porciones) : 0, incompleto };
}
