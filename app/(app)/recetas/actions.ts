"use server";
import { revalidatePath } from "next/cache";
import { db, nulo } from "@/lib/db/supabase";
import { requerirPermiso } from "@/lib/auth/session";
import { z } from "zod";
import { recetaSchema } from "@/lib/validation/schemas";
import { fudo, type ProductoFudo } from "@/lib/services/fudo";
import { MSG_FUDO_CAIDO, MSG_SIN_FUDO } from "@/lib/fudo-mensajes";

type R = { error?: string; ok?: boolean; id?: number };

/** Crea (sin `id`) o edita una receta y reemplaza sus ingredientes; todo en el RPC `guardar_receta`. */
export async function guardarReceta(input: unknown): Promise<R> {
  const s = await requerirPermiso("recetas.gestionar");
  const p = recetaSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;

  const { data, error } = await db.rpc("guardar_receta", {
    p_usuario: s.uid, p_id: d.id ?? nulo,
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

/** Productos de Fudo que coinciden con el texto (para vincular una receta). Sin credenciales o con Fudo caído devuelve un aviso, no un error. */
export async function buscarProductosFudo(q: string): Promise<{ error?: string; productos: ProductoFudo[] }> {
  await requerirPermiso("recetas.gestionar");
  const cliente = fudo();
  if (!cliente) return { error: MSG_SIN_FUDO, productos: [] };
  try {
    return { productos: await cliente.buscar(typeof q === "string" ? q : "") };
  } catch (e) {
    console.error("[fudo] búsqueda:", (e as Error).message);
    return { error: MSG_FUDO_CAIDO, productos: [] };
  }
}

/** Vincula la receta con un producto de Fudo, o la desvincula (`idFudo` vacío). */
export async function vincularFudo(idReceta: number, idFudo: string): Promise<R> {
  const s = await requerirPermiso("recetas.gestionar");
  const id = z.coerce.number().int().positive().safeParse(idReceta);
  const fudoId = z.string().regex(/^(\d{1,15})?$/).safeParse(idFudo);
  if (!id.success || !fudoId.success) return { error: "Datos inválidos" };
  const { error } = await db.rpc("vincular_receta_fudo", { p_usuario: s.uid, p_receta: id.data, p_fudo: fudoId.data });
  if (error) return { error: error.code === "P0001" ? error.message : "No se pudo guardar el vínculo" };
  revalidatePath("/recetas");
  return { ok: true };
}
