import { db } from "./db/supabase";
import type { ItemCatalogo } from "./catalogo-opciones";

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
