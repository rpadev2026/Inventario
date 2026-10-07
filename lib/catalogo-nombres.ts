import { db } from "./db/supabase";
import type { ItemCatalogo } from "./catalogo-opciones";
import type { UnidadInfo } from "./unidades";

type Tabla = "UnidadesMedida" | "Formatos" | "FormasPago";

/** Todas las filas de un catálogo (vigentes y no vigentes), ordenadas por nombre. */
export async function cargarCatalogo(tabla: Tabla): Promise<ItemCatalogo[]> {
  const { data } = await db.from(tabla).select("Codigo,Nombre,IdEstado").order("Nombre");
  return (data ?? []) as ItemCatalogo[];
}

/** Mapa código → nombre para mostrar en pantallas (si no existe, se muestra el código). */
export async function mapaNombres(tabla: Tabla): Promise<Map<string, string>> {
  return new Map((await cargarCatalogo(tabla)).map((i) => [i.Codigo, i.Nombre]));
}

/** Todas las unidades de medida con su familia y factor (vigentes y no vigentes), ordenadas por nombre. */
export async function cargarUnidades(): Promise<UnidadInfo[]> {
  const { data } = await db.from("UnidadesMedida").select("Codigo,Nombre,IdEstado,UnidadBase,Factor").order("Nombre");
  return (data ?? []).map((u) => ({ Codigo: u.Codigo, Nombre: u.Nombre, IdEstado: u.IdEstado, UnidadBase: u.UnidadBase, Factor: Number(u.Factor) }));
}
