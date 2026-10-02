/** Devuelve `v` solo si es una ruta interna segura (nunca redirige fuera del sitio); si no, `null`. */
export function rutaVolverSegura(v: string | null | undefined): string | null {
  if (typeof v !== "string" || !v.startsWith("/")) return null;
  if (v.startsWith("//") || v.startsWith("/\\")) return null;
  if (v.includes(":")) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(v)) return null;
  return v;
}
