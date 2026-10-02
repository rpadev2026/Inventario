"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/supabase";
import { requerirAdmin } from "@/lib/auth/session";
import { rolSchema } from "@/lib/validation/schemas";

export async function guardarRol(_: unknown, fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const s = await requerirAdmin();
  const p = rolSchema.safeParse({
    id: fd.get("id") || undefined,
    nombre: fd.get("nombre") ?? "",
    detalle: fd.get("detalle") ?? undefined,
    estado: fd.get("estado") ?? undefined,
    permisos: fd.getAll("permisos"),
  });
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const { error } = await db.rpc("guardar_rol", {
    p_usuario: s.uid, p_id: d.id ?? null, p_nombre: d.nombre, p_detalle: d.detalle,
    p_estado: d.estado, p_permisos: d.permisos,
  });
  if (error) {
    if (error.code === "P0001") return { error: error.message };
    if (error.code === "23505") return { error: "Ya existe un rol con ese nombre" };
    return { error: "No se pudo guardar" };
  }
  revalidatePath("/mantenedores/roles");
  revalidatePath("/usuarios");
  return { ok: true };
}
