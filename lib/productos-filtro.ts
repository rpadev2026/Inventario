import { normalizar } from "./buscar";

export type ProductoFila = {
  IdProducto: number; Codigo: string | null; Nombre: string; UnidadMedida: string; Formato: string;
  PrecioCompra: number; UnidadBase: string; CostoUnitarioBase: number;
  StockMinimo: number; StockCritico: number; IdEstado: number;
};

/** Filtra por código o nombre (sin distinguir mayúsculas ni tildes) y por estado; ordena por nombre. */
export function filtrarProductos(productos: ProductoFila[], f: { q?: string; estado?: 0 | 1 }): ProductoFila[] {
  const q = normalizar(f.q ?? "");
  return productos
    .filter((p) => (f.estado === undefined || p.IdEstado === f.estado)
      && (!q || normalizar(p.Nombre).includes(q) || (p.Codigo !== null && normalizar(p.Codigo).includes(q))))
    .sort((a, b) => a.Nombre.localeCompare(b.Nombre, "es"));
}
