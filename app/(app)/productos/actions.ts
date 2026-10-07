"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/supabase";
import { requerirPermiso } from "@/lib/auth/session";
import { productoSchema } from "@/lib/validation/schemas";
import { cargarCatalogo, cargarUnidades } from "@/lib/catalogo-nombres";
import { codigoPermitido } from "@/lib/catalogo-opciones";
import { convertirABase, unidadesBase } from "@/lib/unidades";
import { productoTieneMovimientos } from "@/lib/services/productos";

const MSG_UNIDAD_BASE = "Unidad base no válida";
const MSG_FORMATO = "Formato no válido";
const MSG_STOCK_UNIDAD = "La unidad del stock debe ser de la misma familia que la unidad base";

type R = { error?: string; ok?: boolean; id?: number };

export async function guardarProducto(_: unknown, fd: FormData): Promise<R> {
  const s = await requerirPermiso("productos.gestionar");
  const p = productoSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const editando = fd.get("modo") === "editar";
  if (editando && !d.id) return { error: "Producto no válido" };

  const [unidades, formatos, actual, conMovimientos] = await Promise.all([
    cargarUnidades(), cargarCatalogo("Formatos"),
    editando ? db.from("Productos").select("UnidadBase,Formato").eq("IdProducto", d.id!).maybeSingle() : null,
    editando ? productoTieneMovimientos(d.id!) : false,
  ]);
  if (editando && !actual?.data) return { error: "El producto no existe" };

  // Con stock o facturas la unidad base no cambia: se conserva la guardada aunque el formulario envíe otra.
  const unidadBase = editando && conMovimientos ? actual!.data!.UnidadBase : d.unidadBase;
  const baseValida = unidadesBase(unidades).some((u) => u.Codigo === unidadBase) || unidadBase === actual?.data?.UnidadBase;
  if (!baseValida) return { error: MSG_UNIDAD_BASE };
  if (!codigoPermitido(formatos, d.formato, actual?.data?.Formato)) return { error: MSG_FORMATO };

  // El stock se escribe en cualquier unidad de la familia y se guarda en la unidad base.
  const minimo = convertirABase(d.stockMinimo, d.unidadMinimo ?? unidadBase, unidadBase, unidades);
  const critico = convertirABase(d.stockCritico, d.unidadCritico ?? unidadBase, unidadBase, unidades);
  if (minimo === null || critico === null) return { error: MSG_STOCK_UNIDAD };
  if (critico > minimo) return { error: "El stock crítico no puede superar al mínimo" };

  // CostoUnitarioBase no se envía: lo escriben las facturas.
  const fila = {
    Codigo: d.codigo ?? null, Nombre: d.nombre, UnidadBase: unidadBase, Formato: d.formato,
    StockMinimo: minimo, StockCritico: critico, IdEstado: d.estado, IdUsuarioModificacion: s.uid,
  };
  const { data, error } = editando
    ? await db.from("Productos").update(fila).eq("IdProducto", d.id!).select("IdProducto").single()
    : await db.from("Productos").insert({ ...fila, IdUsuarioCreacion: s.uid }).select("IdProducto").single();
  if (error || !data) {
    const detalle = `${error?.message} ${error?.details}`;
    if (error?.code === "P0001") return { error: error.message };
    if (error?.code === "23505") {
      if (/Productos_Codigo_key/.test(detalle)) return { error: "El código ya existe" };
      if (/Productos_Nombre_key/.test(detalle)) return { error: "El nombre ya existe" };
      return { error: "El código o el nombre ya existe" };
    }
    if (error?.code === "23503") return { error: /Formato/.test(detalle) ? MSG_FORMATO : MSG_UNIDAD_BASE };
    return { error: "No se pudo guardar el producto" };
  }
  revalidatePath("/productos");
  return { ok: true, id: data.IdProducto as number };
}
