"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/supabase";
import { requerirPermiso } from "@/lib/auth/session";
import { notificarEnviada, notificarResuelta } from "@/lib/services/correo";

type R = { error?: string; ok?: boolean; id?: number };

const items = z.array(z.object({ producto: z.coerce.number().int().positive(), cantidad: z.coerce.number().min(0) })).min(1).max(200);
const idSchema = z.coerce.number().int().positive();

function mapError(e: { code?: string; message: string }): string {
  if (e.code === "P0001") return e.message; // errores de negocio lanzados por las funciones SQL
  if (e.code === "23514") return "Stock insuficiente en la bodega de origen";
  return "No se pudo completar la operación";
}

const crearSchema = z.object({ idBodega: idSchema, items: items.refine((l) => l.every((i) => i.cantidad > 0), "Las cantidades deben ser mayores a 0") });

export async function guardarSolicitud(input: unknown): Promise<R> {
  const s = await requerirPermiso("solicitudes.crear");
  const idSol = (input as { idSolicitud?: unknown })?.idSolicitud;
  const p = crearSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const { error, data } = idSol
    ? await db.rpc("actualizar_solicitud", { p_usuario: s.uid, p_solicitud: idSchema.parse(idSol), p_bodega: p.data.idBodega, p_items: p.data.items })
    : await db.rpc("crear_solicitud", { p_usuario: s.uid, p_bodega: p.data.idBodega, p_items: p.data.items });
  if (error) return { error: mapError(error) };
  revalidatePath("/solicitudes");
  return { ok: true, id: idSol ? Number(idSol) : (data as number) };
}

export async function enviarSolicitud(fd: FormData) {
  const s = await requerirPermiso("solicitudes.crear");
  const id = idSchema.parse(fd.get("id"));
  const { data: sol } = await db.from("Solicitudes")
    .select("NumeroSolicitud,IdUsuarioSolicitante,Bodegas!inner(NombreBodega),Usuarios!Solicitudes_IdUsuarioSolicitante_fkey!inner(Nombres,Apellidos)")
    .eq("IdSolicitud", id).maybeSingle<any>();
  if (!sol || sol.IdUsuarioSolicitante !== s.uid) return;
  const { error } = await db.rpc("cambiar_estado_solicitud", { p_usuario: s.uid, p_solicitud: id, p_nuevo: 1 });
  if (error) return;
  await notificarEnviada(sol.NumeroSolicitud, `${sol.Usuarios.Nombres} ${sol.Usuarios.Apellidos}`, sol.Bodegas.NombreBodega);
  revalidatePath("/solicitudes");
}

async function correoSolicitante(id: number) {
  const { data } = await db.from("Solicitudes").select("NumeroSolicitud,Usuarios!Solicitudes_IdUsuarioSolicitante_fkey!inner(Correo)").eq("IdSolicitud", id).single<any>();
  return data ? { numero: data.NumeroSolicitud as number, correo: data.Usuarios.Correo as string } : null;
}

async function esPropia(id: number, uid: number) {
  const { data } = await db.from("Solicitudes").select("IdUsuarioSolicitante").eq("IdSolicitud", id).maybeSingle();
  return !data || data.IdUsuarioSolicitante === uid;
}

export async function aprobarSolicitud(input: unknown): Promise<R> {
  const s = await requerirPermiso("solicitudes.gestionar");
  const p = z.object({ id: idSchema, items }).safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  if (await esPropia(p.data.id, s.uid)) return { error: "No puede aprobar su propia solicitud" };
  const { error } = await db.rpc("aprobar_solicitud", { p_usuario: s.uid, p_solicitud: p.data.id, p_items: p.data.items });
  if (error) return { error: mapError(error) };
  const sol = await correoSolicitante(p.data.id);
  if (sol) await notificarResuelta(sol.numero, sol.correo, true);
  revalidatePath("/solicitudes");
  return { ok: true };
}

export async function rechazarSolicitud(fd: FormData) {
  const s = await requerirPermiso("solicitudes.gestionar");
  const id = idSchema.parse(fd.get("id"));
  if (await esPropia(id, s.uid)) return;
  const { error } = await db.rpc("cambiar_estado_solicitud", { p_usuario: s.uid, p_solicitud: id, p_nuevo: 5 });
  if (error) return;
  const sol = await correoSolicitante(id);
  if (sol) await notificarResuelta(sol.numero, sol.correo, false);
  revalidatePath("/solicitudes");
}

export async function recepcionarSolicitud(input: unknown): Promise<R> {
  const s = await requerirPermiso("solicitudes.ver_propias");
  const p = z.object({ id: idSchema, items: items.transform((l) => l.filter((i) => i.cantidad > 0)).refine((l) => l.length > 0, "Indique al menos una cantidad recibida") }).safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const { error } = await db.rpc("recepcionar_solicitud", { p_usuario: s.uid, p_solicitud: p.data.id, p_items: p.data.items });
  if (error) return { error: mapError(error) };
  revalidatePath("/solicitudes");
  revalidatePath("/bodegas");
  return { ok: true };
}
