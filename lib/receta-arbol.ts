/**
 * Recetas que contienen a `id` como sub-receta, directa o indirectamente (sus «ancestros»). Una receta no puede
 * incluir como sub-receta a ninguna de ellas: formaría un ciclo. `pares` son las aristas «receta contiene sub-receta».
 */
export function recetasQueContienen(id: number, pares: { receta: number; sub: number }[]): Set<number> {
  const out = new Set<number>();
  const pendientes = [id];
  while (pendientes.length) {
    const actual = pendientes.pop()!;
    for (const p of pares) if (p.sub === actual && !out.has(p.receta)) { out.add(p.receta); pendientes.push(p.receta); }
  }
  return out;
}
