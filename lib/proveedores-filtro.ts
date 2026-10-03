import { normalizar } from "./buscar";

export type ProveedorFila = {
  IdProveedor: number; Rut: string; RazonSocial: string; Giro: string | null;
  Telefono: string | null; Correo: string | null; IdEstado: number;
};

/** Filtra por RUT (con o sin puntos y guion), razón social o giro, sin distinguir mayúsculas ni tildes, y por estado; ordena por razón social. */
export function filtrarProveedores(proveedores: ProveedorFila[], f: { q?: string; estado?: 0 | 1 }): ProveedorFila[] {
  const q = normalizar(f.q ?? "");
  return proveedores
    .filter((p) => (f.estado === undefined || p.IdEstado === f.estado)
      && (!q || normalizar(p.Rut).includes(q) || normalizar(p.RazonSocial).includes(q) || normalizar(p.Giro ?? "").includes(q)))
    .sort((a, b) => a.RazonSocial.localeCompare(b.RazonSocial, "es"));
}
