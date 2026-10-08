"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/supabase";
import { requerirPermiso } from "@/lib/auth/session";
import { recetaSchema } from "@/lib/validation/schemas";

type R = { error?: string; ok?: boolean; id?: number };

/** Crea (sin `id`) o edita una receta y reemplaza sus ingredientes; todo en el RPC `guardar_receta`. */
export async function guardarReceta(input: unknown): Promise<R> {
  const s = await requerirPermiso("recetas.gestionar");
  const p = recetaSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;

  const { data, error } = await db.rpc("guardar_receta", {
    p_usuario: s.uid, p_id: d.id ?? null,
    p_cabecera: {
      codigo: d.codigo ?? null, nombre: d.nombre, porciones: d.porciones,
      rendimientoCantidad: d.rendimientoCantidad ?? null, rendimientoUnidad: d.rendimientoUnidad ?? null, estado: d.estado,
    },
    p_detalle: d.detalle.map((l) => ({
      [l.tipo === "producto" ? "producto" : "subreceta"]: l.ingrediente,
      cantidad: l.cantidad, porcion: l.porcion, unidad: l.unidad, merma: l.merma,
    })),
  });
  if (error) {
    // Los mensajes de negocio (raise exception) son seguros de mostrar.
    if (error.code === "P0001") return { error: error.message };
    if (error.code === "23505") {
      const detalle = `${error.message} ${error.details}`;
      if (/Recetas_CodigoReceta_key/.test(detalle)) return { error: "El código ya existe" };
      if (/Recetas_Nombre_key/.test(detalle)) return { error: "El nombre ya existe" };
      return { error: "El código o el nombre ya existe" };
    }
    return { error: "No se pudo guardar la receta" };
  }
  revalidatePath("/recetas");
  return { ok: true, id: Number(data) };
}
