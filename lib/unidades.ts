/** Unidad de medida con su familia: `UnidadBase` es la unidad base de la familia y `Factor` cuántas unidades base vale 1 de esta. */
export type UnidadInfo = { Codigo: string; Nombre: string; IdEstado: number; UnidadBase: string; Factor: number };

/** Unidades vigentes que son su propia base (factor 1): las únicas que se pueden elegir como unidad base de un producto. */
export function unidadesBase(unidades: UnidadInfo[]): UnidadInfo[] {
  return unidades.filter((u) => u.IdEstado === 1 && u.UnidadBase === u.Codigo);
}

/** Unidades vigentes de la familia de `base` (más `actual` aunque esté inactiva), p. ej. Gramo y Kilo para la base Gramo. */
export function unidadesDeFamilia(unidades: UnidadInfo[], base: string, actual?: string | null): UnidadInfo[] {
  return unidades.filter((u) => u.UnidadBase === base && (u.IdEstado === 1 || u.Codigo === actual));
}

/** `valor` expresado en `unidad` llevado a la unidad `base` (3 decimales); `null` si la unidad no existe o es de otra familia. */
export function convertirABase(valor: number, unidad: string, base: string, unidades: UnidadInfo[]): number | null {
  const u = unidades.find((x) => x.Codigo === unidad);
  if (!u || u.UnidadBase !== base) return null;
  return Math.round(valor * u.Factor * 1000) / 1000;
}
