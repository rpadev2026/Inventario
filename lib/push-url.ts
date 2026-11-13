/** La ruta de un aviso push solo puede ser interna: si no empieza por «/» (o es «//», o lleva «\»), se usa el inicio. */
export function rutaInterna(url: unknown): string {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") && !url.includes("\\") ? url : "/";
}
