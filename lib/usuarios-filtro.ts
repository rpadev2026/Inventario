import { normalizar } from "./buscar";

export type UsuarioFila = { IdUsuario: number; Rut: string; Nombres: string; Apellidos: string; Correo: string; IdEstado: number };

/** Filtra por RUT (con o sin puntos y guion), nombre completo o correo, sin distinguir mayúsculas ni tildes, y por estado; ordena por apellidos y nombres. */
export function filtrarUsuarios(usuarios: UsuarioFila[], f: { q?: string; estado?: 0 | 1 }): UsuarioFila[] {
  const q = normalizar(f.q ?? "");
  return usuarios
    .filter((u) => (f.estado === undefined || u.IdEstado === f.estado)
      && (!q || normalizar(u.Rut).includes(q) || normalizar(`${u.Nombres} ${u.Apellidos}`).includes(q) || normalizar(u.Correo).includes(q)))
    .sort((a, b) => a.Apellidos.localeCompare(b.Apellidos, "es") || a.Nombres.localeCompare(b.Nombres, "es"));
}
