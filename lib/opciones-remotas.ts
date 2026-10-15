import { buscarProductos, buscarProveedores, type ProductoHallado, type ProveedorHallado } from "@/app/(app)/buscar/actions";
import type { Opcion } from "./buscar";
import { etiquetaProducto } from "./producto-etiqueta";

/** Opción de un producto: «código — nombre (unidad)». */
export const opcionProducto = (p: ProductoHallado): Opcion => ({
  valor: String(p.id),
  etiqueta: `${etiquetaProducto(p.codigo, p.nombre)} (${p.unidadNombre})${p.vigente ? "" : " (no vigente)"}`,
  busqueda: `${p.codigo ?? ""} ${p.nombre}`,
  datos: { unidadBase: p.unidadBase, costoBase: p.costoBase === null ? null : String(p.costoBase) },
});

/** Opción de un proveedor: «RUT — razón social». */
export const opcionProveedor = (p: ProveedorHallado): Opcion => ({
  valor: String(p.id), etiqueta: `${p.rut} — ${p.nombre}`, busqueda: `${p.rut} ${p.nombre}`,
});

// Funciones estables (a nivel de módulo): ComboboxRemoto vuelve a buscar si cambia la identidad de `buscar`.
export const buscarOpcionesProducto = async (q: string) => (await buscarProductos(q)).map(opcionProducto);
export const buscarOpcionesProveedor = async (q: string) => (await buscarProveedores(q)).map(opcionProveedor);
