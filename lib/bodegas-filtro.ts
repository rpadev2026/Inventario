import { normalizar } from "./buscar";

export type BodegaFila = { IdBodega: number; NombreBodega: string; EsCentral: boolean; IdEstado: number };

/** Estado pedido en la URL: 1 (vigente) o 0 (no vigente); cualquier otro valor significa «todos» (undefined). */
export function leerEstado(v: unknown): 0 | 1 | undefined {
  return v === "1" ? 1 : v === "0" ? 0 : undefined;
}

/** Filtra por nombre (sin distinguir mayúsculas ni tildes) y estado; ordena con la Bodega Central primero y luego por nombre. */
export function filtrarBodegas(bodegas: BodegaFila[], f: { q?: string; estado?: 0 | 1 }): BodegaFila[] {
  const q = normalizar(f.q ?? "");
  return bodegas
    .filter((b) => (f.estado === undefined || b.IdEstado === f.estado) && (!q || normalizar(b.NombreBodega).includes(q)))
    .sort((a, b) => Number(b.EsCentral) - Number(a.EsCentral) || a.NombreBodega.localeCompare(b.NombreBodega, "es"));
}
