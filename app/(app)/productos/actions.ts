"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/supabase";
import { requerirPermiso } from "@/lib/auth/session";
import { productoSchema } from "@/lib/validation/schemas";
import { cargarCatalogo } from "@/lib/catalogo-nombres";
import { codigoPermitido } from "@/lib/catalogo-opciones";

const MSG_UNIDAD = "Unidad de medida no válida";
const MSG_FORMATO = "Formato no válido";

type R = { error?: string; ok?: boolean; codigo?: string };

export async function guardarProducto(_: unknown, fd: FormData): Promise<R> {
  const s = await requerirPermiso("productos.gestionar");
  const p = productoSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const fila = {
    NombreProducto: d.nombre, UnidadMedida: d.unidad, Formato: d.formato,
    StockMinimo: d.stockMinimo, StockCritico: d.stockCritico, IdEstado: d.estado, IdUsuarioModificacion: s.uid,
  };
  const editando = fd.get("modo") === "editar";
  const [unidades, formatos, actual] = await Promise.all([
    cargarCatalogo("UnidadesMedida"), cargarCatalogo("Formatos"),
    editando ? db.from("Productos").select("UnidadMedida,Formato").eq("CodigoProducto", d.codigo).maybeSingle() : null,
  ]);
  if (!codigoPermitido(unidades, d.unidad, actual?.data?.UnidadMedida)) return { error: MSG_UNIDAD };
  if (!codigoPermitido(formatos, d.formato, actual?.data?.Formato)) return { error: MSG_FORMATO };
  const { error } = editando
    ? await db.from("Productos").update(fila).eq("CodigoProducto", d.codigo)
    : await db.from("Productos").insert({ CodigoProducto: d.codigo, ...fila, IdUsuarioCreacion: s.uid });
  if (error) {
    if (error.code === "23505") return { error: "El código ya existe" };
    if (error.code === "23503") return { error: /Formato/.test(`${error.message} ${error.details}`) ? MSG_FORMATO : MSG_UNIDAD };
    return { error: "No se pudo guardar el producto" };
  }
  revalidatePath("/productos");
  return { ok: true, codigo: d.codigo };
}
