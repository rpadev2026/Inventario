import { normalizar } from "./buscar";

/** Fila de un catálogo; `padre` es la etiqueta ya resuelta del padre (región o ciudad), si lo tiene. */
export type ItemFila = { Codigo: string; Nombre: string; IdEstado: number; padre?: string };

/** Filtra por código, nombre o nombre del padre (sin distinguir mayúsculas ni tildes) y por estado; ordena por nombre. */
export function filtrarCatalogo<T extends ItemFila>(items: T[], f: { q?: string; estado?: 0 | 1 }): T[] {
  const q = normalizar(f.q ?? "");
  return items
    .filter((i) => (f.estado === undefined || i.IdEstado === f.estado)
      && (!q || normalizar(i.Codigo).includes(q) || normalizar(i.Nombre).includes(q) || normalizar(i.padre ?? "").includes(q)))
    .sort((a, b) => a.Nombre.localeCompare(b.Nombre, "es"));
}
