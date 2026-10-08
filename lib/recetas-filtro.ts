import { normalizar } from "./buscar";

export type RecetaFila = { IdReceta: number; CodigoReceta: string | null; Nombre: string; RendimientoPorciones: number; IdEstado: number };

/** Filtra por código o nombre (sin distinguir mayúsculas ni tildes) y por estado; ordena por nombre. */
export function filtrarRecetas(recetas: RecetaFila[], f: { q?: string; estado?: 0 | 1 }): RecetaFila[] {
  const q = normalizar(f.q ?? "");
  return recetas
    .filter((r) => (f.estado === undefined || r.IdEstado === f.estado)
      && (!q || normalizar(r.Nombre).includes(q) || (r.CodigoReceta !== null && normalizar(r.CodigoReceta).includes(q))))
    .sort((a, b) => a.Nombre.localeCompare(b.Nombre, "es"));
}
