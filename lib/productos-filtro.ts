import { normalizar } from "./buscar";

export type ProductoFila = {
  CodigoProducto: string; NombreProducto: string; UnidadMedida: string; Formato: string;
  StockMinimo: number; StockCritico: number; IdEstado: number;
};

/** Filtra por código o nombre (sin distinguir mayúsculas ni tildes) y por estado; ordena por nombre. */
export function filtrarProductos(productos: ProductoFila[], f: { q?: string; estado?: 0 | 1 }): ProductoFila[] {
  const q = normalizar(f.q ?? "");
  return productos
    .filter((p) => (f.estado === undefined || p.IdEstado === f.estado)
      && (!q || normalizar(p.NombreProducto).includes(q) || normalizar(p.CodigoProducto).includes(q)))
    .sort((a, b) => a.NombreProducto.localeCompare(b.NombreProducto, "es"));
}
