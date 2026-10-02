"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/supabase";
import { requerirAdmin } from "@/lib/auth/session";
import { validarRut, normalizarRut } from "@/lib/validation/rut";
import { fijarClave } from "@/lib/services/claves";

type R = { error?: string; ok?: boolean };

const crearSchema = z.object({
  rut: z.string().refine(validarRut, "RUT inválido"),
  nombres: z.string().trim().min(1).max(100),
  apellidos: z.string().trim().min(1).max(100),
  correo: z.string().trim().toLowerCase().email().max(254),
  password: z.string().max(128),
  idRol: z.coerce.number().int().positive(),
});

export async function crearUsuario(_: unknown, fd: FormData): Promise<R> {
  const s = await requerirAdmin();
  const p = crearSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const { data: u, error } = await db.from("Usuarios").insert({
    Rut: normalizarRut(d.rut), Nombres: d.nombres, Apellidos: d.apellidos, Correo: d.correo,
    IdUsuarioCreacion: s.uid, IdUsuarioModificacion: s.uid,
  }).select("IdUsuario").single();
  if (error) return { error: error.code === "23505" ? "RUT o correo ya registrado" : "No se pudo crear el usuario" };
  const err = await fijarClave(u.IdUsuario, d.password, s.uid, true);
  if (err) {
    await db.from("Usuarios").delete().eq("IdUsuario", u.IdUsuario);
    return { error: err };
  }
  await db.from("UsuariosRoles").insert({ IdUsuario: u.IdUsuario, IdRol: d.idRol, IdUsuarioCreacion: s.uid, IdUsuarioModificacion: s.uid });
  revalidatePath("/usuarios");
  return { ok: true };
}

export async function cambiarEstadoUsuario(fd: FormData) {
  const s = await requerirAdmin();
  const id = z.coerce.number().int().positive().parse(fd.get("id"));
  const estado = z.coerce.number().pipe(z.union([z.literal(0), z.literal(1)])).parse(fd.get("estado"));
  if (id === s.uid) return; // no puede desactivarse a sí mismo
  await db.from("Usuarios").update({ IdEstado: estado, IdUsuarioModificacion: s.uid }).eq("IdUsuario", id);
  revalidatePath("/usuarios");
}

export async function asignarRol(fd: FormData) {
  const s = await requerirAdmin();
  const id = z.coerce.number().int().positive().parse(fd.get("id"));
  const rol = z.coerce.number().int().positive().parse(fd.get("idRol"));
  await db.from("UsuariosRoles").upsert(
    { IdUsuario: id, IdRol: rol, IdEstado: 1, IdUsuarioCreacion: s.uid, IdUsuarioModificacion: s.uid },
    { onConflict: "IdUsuario,IdRol" },
  );
  revalidatePath("/usuarios");
}

export async function quitarRol(fd: FormData) {
  const s = await requerirAdmin();
  const id = z.coerce.number().int().positive().parse(fd.get("id"));
  const rol = z.coerce.number().int().positive().parse(fd.get("idRol"));
  if (id === s.uid) {
    // Evita que el último administrador se quite el rol y deje el sistema sin gestión de usuarios.
    const { data: r } = await db.from("Roles").select("NombreRol").eq("IdRol", rol).maybeSingle();
    if (r?.NombreRol === "Administrador") return;
  }
  await db.from("UsuariosRoles").update({ IdEstado: 0, IdUsuarioModificacion: s.uid }).eq("IdUsuario", id).eq("IdRol", rol);
  revalidatePath("/usuarios");
}

export async function resetearClave(_: unknown, fd: FormData): Promise<R> {
  const s = await requerirAdmin();
  const id = z.coerce.number().int().positive().parse(fd.get("id"));
  const err = await fijarClave(id, String(fd.get("password") ?? ""), s.uid, true);
  return err ? { error: err } : { ok: true };
}
