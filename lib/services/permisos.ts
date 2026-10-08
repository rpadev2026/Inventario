import { db } from "../db/supabase";
import type { PermisoCatalogo } from "../auth/permisos";

/** Catálogo de permisos desde la tabla "Permisos", en el orden de la columna Orden. */
export async function cargarPermisos(): Promise<PermisoCatalogo[]> {
  const { data } = await db.from("Permisos").select("Codigo,Modulo,Descripcion").order("Orden");
  return ((data ?? []) as { Codigo: string; Modulo: string; Descripcion: string }[])
    .map((p) => ({ codigo: p.Codigo, modulo: p.Modulo, descripcion: p.Descripcion }));
}
