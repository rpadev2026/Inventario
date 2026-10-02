export type ItemCatalogo = { Codigo: string; Nombre: string; IdEstado: number };
export type Opcion = { codigo: string; etiqueta: string };

/** Opciones de un desplegable: solo vigentes, más la opción actual si está inactiva (marcada). */
export function opcionesCatalogo(items: ItemCatalogo[], actual?: string | null): Opcion[] {
  return items
    .filter((i) => i.IdEstado === 1 || i.Codigo === actual)
    .map((i) => ({ codigo: i.Codigo, etiqueta: i.IdEstado === 1 ? i.Nombre : `${i.Nombre} (no vigente)` }));
}

/** ¿Se puede guardar este código? Debe existir y estar vigente, salvo que no cambie respecto del valor actual. */
export function codigoPermitido(items: ItemCatalogo[], codigo: string, actual?: string | null): boolean {
  const it = items.find((i) => i.Codigo === codigo);
  if (!it) return false;
  return it.IdEstado === 1 || codigo === actual;
}
