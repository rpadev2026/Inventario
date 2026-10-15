import { buscarProductos, buscarProveedores, buscarSubrecetas, type ProductoHallado, type ProveedorHallado, type SubrecetaHallada } from "@/app/(app)/buscar/actions";
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

/** Opción de una sub-receta: su nombre; lleva la unidad del rendimiento y el costo por unidad base. */
export const opcionSubreceta = (s: SubrecetaHallada): Opcion => ({
  valor: String(s.id), etiqueta: s.nombre + (s.vigente ? "" : " (no vigente)"), busqueda: s.nombre,
  datos: { rendimientoUnidad: s.rendimientoUnidad, costoPorBase: s.costoPorBase === null ? null : String(s.costoPorBase) },
});

// Funciones estables (a nivel de módulo): ComboboxRemoto vuelve a buscar si cambia la identidad de `buscar`.
export const buscarOpcionesProducto = async (q: string) => (await buscarProductos(q)).map(opcionProducto);
export const buscarOpcionesProveedor = async (q: string) => (await buscarProveedores(q)).map(opcionProveedor);
/** Buscador de sub-recetas de la receta `excluir` (sin ella ni las que la contienen). Crear una vez por receta: debe ser estable. */
export const buscarOpcionesSubreceta = (excluir?: number) => async (q: string) => (await buscarSubrecetas(q, excluir)).map(opcionSubreceta);
