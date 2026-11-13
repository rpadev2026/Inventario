"use server";
import { z } from "zod";
import { db } from "@/lib/db/supabase";
import { requerirPermiso } from "@/lib/auth/session";

type R = { ok?: true; error?: string };
const PERMISOS = ["solicitudes.ver_propias", "solicitudes.gestionar"] as const;
const endpoint = z.string().trim().max(2048, "Suscripción inválida").refine((e) => e.startsWith("https://"), "Suscripción inválida");
const clave = z.string().trim().min(1, "Suscripción inválida").max(256, "Suscripción inválida");

/** Guarda la suscripción de ESTE dispositivo para el usuario de la sesión (el endpoint identifica al dispositivo). */
export async function suscribirPush(input: unknown): Promise<R> {
  const s = await requerirPermiso(...PERMISOS);
  const p = z.object({ endpoint, p256dh: clave, auth: clave }).safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const { error } = await db.rpc("guardar_suscripcion_push", { p_usuario: s.uid, p_endpoint: p.data.endpoint, p_p256dh: p.data.p256dh, p_auth: p.data.auth });
  if (error) { console.error("[push] no se pudo guardar la suscripción:", error.code); return { error: "No se pudo activar los avisos. Intente nuevamente." }; }
  return { ok: true };
}

export async function desuscribirPush(input: unknown): Promise<R> {
  await requerirPermiso(...PERMISOS);
  const p = z.object({ endpoint }).safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const { error } = await db.rpc("quitar_suscripcion_push", { p_endpoint: p.data.endpoint });
  if (error) { console.error("[push] no se pudo quitar la suscripción:", error.code); return { error: "No se pudo desactivar los avisos. Intente nuevamente." }; }
  return { ok: true };
}
