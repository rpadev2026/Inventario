export type Opcion = { valor: string; etiqueta: string; busqueda: string };

/** Minúsculas, sin tildes, sin puntos ni guiones y sin espacios dobles. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Coincidencia por subcadena sobre `normalizar(busqueda)`; texto vacío → las primeras `max`. */
export function filtrarOpciones(opciones: Opcion[], texto: string, max = 8): Opcion[] {
  const t = normalizar(texto);
  if (!t) return opciones.slice(0, max);
  const out: Opcion[] = [];
  for (const o of opciones) {
    if (normalizar(o.busqueda).includes(t)) {
      out.push(o);
      if (out.length >= max) break;
    }
  }
  return out;
}
