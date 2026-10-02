"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/supabase";
import { requerirAdmin } from "@/lib/auth/session";

type R = { error?: string; ok?: boolean };

const schema = z.object({ nombre: z.string().trim().min(1, "Nombre requerido").max(100), estado: z.coerce.number().pipe(z.union([z.literal(0), z.literal(1)])).default(1) });

export async function guardarBodega(_: unknown, fd: FormData): Promise<R> {
  const s = await requerirAdmin();
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const idBodega = fd.get("idBodega");
  if (idBodega) {
    const id = z.coerce.number().int().positive().parse(idBodega);
    // La Bodega Central no se puede desactivar (sin ella no hay ingreso de facturas).
    const { data: b } = await db.from("Bodegas").select("EsCentral").eq("IdBodega", id).maybeSingle();
    if (!b) return { error: "Bodega no existe" };
    const estado = b.EsCentral ? 1 : p.data.estado;
    const { error } = await db.from("Bodegas").update({ NombreBodega: p.data.nombre, IdEstado: estado, IdUsuarioModificacion: s.uid, FechaModificacion: new Date().toISOString() }).eq("IdBodega", id);
    if (error) return { error: error.code === "23505" ? "Ya existe una bodega con ese nombre" : "No se pudo guardar" };
  } else {
    const { error } = await db.from("Bodegas").insert({ NombreBodega: p.data.nombre, IdEstado: p.data.estado, IdUsuarioCreacion: s.uid, IdUsuarioModificacion: s.uid });
    if (error) return { error: error.code === "23505" ? "Ya existe una bodega con ese nombre" : "No se pudo guardar" };
  }
  revalidatePath("/bodegas");
  return { ok: true };
}
