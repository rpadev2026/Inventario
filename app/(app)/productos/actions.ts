"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/supabase";
import { requerirPermiso } from "@/lib/auth/session";
import { productoSchema } from "@/lib/validation/schemas";
import { cargarCatalogo } from "@/lib/catalogo-nombres";
import { codigoPermitido } from "@/lib/catalogo-opciones";

const MSG_UNIDAD = "Unidad de medida no válida";
const MSG_FORMATO = "Formato no válido";

type R = { error?: string; ok?: boolean; id?: number };

export async function guardarProducto(_: unknown, fd: FormData): Promise<R> {
  const s = await requerirPermiso("productos.gestionar");
  const p = productoSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const editando = fd.get("modo") === "editar";
  if (editando && !d.id) return { error: "Producto no válido" };
  // UnidadBase y CostoUnitarioBase no se envían: los calcula la base de datos desde la unidad de medida.
  const fila = {
    Codigo: d.codigo ?? null, Nombre: d.nombre, UnidadMedida: d.unidad, Formato: d.formato, PrecioCompra: d.precioCompra,
    StockMinimo: d.stockMinimo, StockCritico: d.stockCritico, IdEstado: d.estado, IdUsuarioModificacion: s.uid,
  };
  const [unidades, formatos, actual] = await Promise.all([
    cargarCatalogo("UnidadesMedida"), cargarCatalogo("Formatos"),
    editando ? db.from("Productos").select("UnidadMedida,Formato").eq("IdProducto", d.id!).maybeSingle() : null,
  ]);
  if (editando && !actual?.data) return { error: "El producto no existe" };
  if (!codigoPermitido(unidades, d.unidad, actual?.data?.UnidadMedida)) return { error: MSG_UNIDAD };
  if (!codigoPermitido(formatos, d.formato, actual?.data?.Formato)) return { error: MSG_FORMATO };
  const { data, error } = editando
    ? await db.from("Productos").update(fila).eq("IdProducto", d.id!).select("IdProducto").single()
    : await db.from("Productos").insert({ ...fila, IdUsuarioCreacion: s.uid }).select("IdProducto").single();
  if (error || !data) {
    const detalle = `${error?.message} ${error?.details}`;
    if (error?.code === "23505") {
      if (/Productos_Codigo_key/.test(detalle)) return { error: "El código ya existe" };
      if (/Productos_Nombre_key/.test(detalle)) return { error: "El nombre ya existe" };
      return { error: "El código o el nombre ya existe" };
    }
    if (error?.code === "23503") return { error: /Formato/.test(detalle) ? MSG_FORMATO : MSG_UNIDAD };
    return { error: "No se pudo guardar el producto" };
  }
  revalidatePath("/productos");
  return { ok: true, id: data.IdProducto as number };
}
