/**
 * URL de un listado con solo los parámetros indicados (los undefined se omiten). `crear: "1"` no se escribe en la URL: manda a la ruta
 * propia de creación (`/productos/nuevo`, como `/compras/nueva`), conservando página y filtros del listado para el botón Volver.
 */
export function construirHref(raiz: string, rutaCrear: string, q: Record<string, string | undefined>): string {
  const { crear, ...resto } = q;
  const destino = crear === "1" ? rutaCrear : raiz;
  const s = new URLSearchParams(Object.entries(resto).filter(([, v]) => v !== undefined) as [string, string][]).toString();
  return s ? `${destino}?${s}` : destino;
}
