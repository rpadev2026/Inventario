import { normalizar } from "./buscar";

export type RolFila = { IdRol: number; NombreRol: string; DetalleRol: string | null; IdEstado: number; EsBase: boolean };

/** Filtra por nombre o detalle (sin distinguir mayúsculas ni tildes) y por estado; mantiene el orden de creación. */
export function filtrarRoles(roles: RolFila[], f: { q?: string; estado?: 0 | 1 }): RolFila[] {
  const q = normalizar(f.q ?? "");
  return roles
    .filter((r) => (f.estado === undefined || r.IdEstado === f.estado)
      && (!q || normalizar(r.NombreRol).includes(q) || normalizar(r.DetalleRol ?? "").includes(q)))
    .sort((a, b) => a.IdRol - b.IdRol);
}
