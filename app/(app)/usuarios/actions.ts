"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/supabase";
import { requerirAdmin } from "@/lib/auth/session";
import { normalizarRut } from "@/lib/validation/rut";
import { crearUsuarioSchema, editarUsuarioSchema } from "@/lib/validation/usuario";
import { fijarClave } from "@/lib/services/claves";
import { hashPassword } from "@/lib/auth/password";
import { validarPolitica } from "@/lib/validation/password";

type R = { error?: string; ok?: boolean };

/** Distingue qué dato único se repite (la restricción nombra la columna). */
function mensajeDuplicado(error: { message?: string; details?: string | null }): string {
  return /Correo/i.test(`${error.message} ${error.details}`) ? "El correo ya está registrado" : "El RUT ya está registrado";
}

export async function crearUsuario(_: unknown, fd: FormData): Promise<R> {
  const s = await requerirAdmin();
  const p = crearUsuarioSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const err = validarPolitica(d.password);
  if (err) return { error: err };
  // Usuario, clave temporal, historial y rol en una sola transacción: no quedan cuentas a medias.
  const { error } = await db.rpc("crear_usuario", {
    p_actor: s.uid, p_rut: normalizarRut(d.rut), p_nombres: d.nombres, p_apellidos: d.apellidos,
    p_correo: d.correo, p_hash: await hashPassword(d.password), p_rol: d.idRol,
  });
  if (error) {
    if (error.code === "23505") return { error: mensajeDuplicado(error) };
    if (error.code === "P0001") return { error: error.message };
    return { error: "No se pudo crear el usuario" };
  }
  revalidatePath("/usuarios");
  return { ok: true };
}

export async function guardarUsuario(_: unknown, fd: FormData): Promise<R> {
  const s = await requerirAdmin();
  const p = editarUsuarioSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  if (d.id === s.uid && d.estado === 0) return { error: "No puede desactivar su propio usuario" };
  const { data: existe } = await db.from("Usuarios").select("IdUsuario").eq("IdUsuario", d.id).maybeSingle();
  if (!existe) return { error: "El usuario no existe" };
  const { error } = await db.from("Usuarios")
    .update({ Nombres: d.nombres, Apellidos: d.apellidos, Correo: d.correo, IdEstado: d.estado, IdUsuarioModificacion: s.uid })
    .eq("IdUsuario", d.id);
  if (error) return { error: error.code === "23505" ? mensajeDuplicado(error) : "No se pudo guardar el usuario" };
  revalidatePath("/usuarios");
  return { ok: true };
}

export async function asignarRol(fd: FormData) {
  const s = await requerirAdmin();
  const id = z.coerce.number().int().positive().parse(fd.get("id"));
  const rol = z.coerce.number().int().positive().parse(fd.get("idRol"));
  const { error } = await db.from("UsuariosRoles").upsert(
    { IdUsuario: id, IdRol: rol, IdEstado: 1, IdUsuarioCreacion: s.uid, IdUsuarioModificacion: s.uid },
    { onConflict: "IdUsuario,IdRol" },
  );
  if (error) throw new Error("No se pudo asignar el rol");
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
  const { error } = await db.from("UsuariosRoles").update({ IdEstado: 0, IdUsuarioModificacion: s.uid }).eq("IdUsuario", id).eq("IdRol", rol);
  if (error) throw new Error("No se pudo quitar el rol");
  revalidatePath("/usuarios");
}

export async function resetearClave(_: unknown, fd: FormData): Promise<R> {
  const s = await requerirAdmin();
  const id = z.coerce.number().int().positive().parse(fd.get("id"));
  const err = await fijarClave(id, String(fd.get("password") ?? ""), s.uid, true);
  return err ? { error: err } : { ok: true };
}
