import { revalidatePath } from "next/cache";
import { db } from "../db/supabase";
import { catalogoSchema } from "../validation/catalogo";

export type CatalogoCfg = {
  tabla: "FormasPago" | "UnidadesMedida" | "Formatos";
  id: "IdFormaPago" | "IdUnidadMedida" | "IdFormato";
  titulo: string;
  ruta: string;
};

export const CATALOGOS: Record<"formasPago" | "unidades" | "formatos", CatalogoCfg> = {
  formasPago: { tabla: "FormasPago", id: "IdFormaPago", titulo: "Formas de pago", ruta: "/mantenedores/formas-pago" },
  unidades: { tabla: "UnidadesMedida", id: "IdUnidadMedida", titulo: "Unidades de medida", ruta: "/mantenedores/unidades-medida" },
  formatos: { tabla: "Formatos", id: "IdFormato", titulo: "Formatos", ruta: "/mantenedores/formatos" },
};

type Datos = { codigo: string; nombre: string; estado: number };

/** Fila a persistir. Al editar nunca incluye `Codigo` (inmutable). */
export function prepararFila(_cfg: CatalogoCfg, d: Datos, uid: number, editando: boolean) {
  const base = { Nombre: d.nombre, IdEstado: d.estado, IdUsuarioModificacion: uid };
  return editando ? base : { Codigo: d.codigo, ...base, IdUsuarioCreacion: uid };
}

export async function guardarCatalogo(
  cfg: CatalogoCfg, uid: number, fd: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const p = catalogoSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const editando = fd.get("modo") === "editar";
  const fila = prepararFila(cfg, p.data, uid, editando);
  const { error } = editando
    ? await db.from(cfg.tabla).update(fila).eq("Codigo", p.data.codigo)
    : await db.from(cfg.tabla).insert(fila);
  if (error) return { error: error.code === "23505" ? "Ya existe un registro con ese código" : "No se pudo guardar" };
  revalidatePath(cfg.ruta);
  return { ok: true };
}
