type Resultado<T> = { data: T[] | null; error: unknown; count?: number | null };

/**
 * Lee TODAS las filas de una consulta aunque la API limite cuántas devuelve por petición (p. ej. 1.000).
 * `armar(desde, hasta)` debe pedir `select(cols, { count: "exact" })`, un orden ESTABLE (con el id como desempate) y `.range(desde, hasta)`.
 * Si una lectura falla lanza error: un catálogo incompleto no debe mostrarse como si estuviera completo.
 */
export async function leerTodo<T>(armar: (desde: number, hasta: number) => PromiseLike<Resultado<T>>, bloque = 1000): Promise<{ data: T[]; error: null }> {
  const filas: T[] = [];
  for (;;) {
    const { data, error, count } = await armar(filas.length, filas.length + bloque - 1);
    if (error) throw new Error("No se pudo leer el catálogo");
    filas.push(...(data ?? []));
    // Termina al llegar al total; sin total, cuando una petición vuelve vacía (la API puede devolver menos del bloque pedido).
    if (!data?.length || (count != null && filas.length >= count)) return { data: filas, error: null };
  }
}
