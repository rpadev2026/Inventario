/** Estado pedido en la URL: 1 (vigente) o 0 (no vigente); cualquier otro valor significa «todos» (undefined). */
export function leerEstado(v: unknown): 0 | 1 | undefined {
  return v === "1" ? 1 : v === "0" ? 0 : undefined;
}
