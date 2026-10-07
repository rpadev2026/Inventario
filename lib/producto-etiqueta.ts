/** Texto con que se muestra un producto en selectores y listados: «código — nombre», o solo el nombre si no tiene código. */
export function etiquetaProducto(codigo: string | null | undefined, nombre: string): string {
  return codigo ? `${codigo} — ${nombre}` : nombre;
}
