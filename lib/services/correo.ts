import "server-only";
import { Resend } from "resend";
import { db } from "@/lib/db/supabase";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Envía un correo. Nunca lanza: un fallo de correo no debe revertir la operación de negocio. */
async function enviar(para: string[], asunto: string, html: string) {
  if (!para.length) return;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[correo] RESEND_API_KEY no configurada; no se envía:", asunto);
    return;
  }
  const resend = new Resend(key);
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const { error } = await resend.emails.send({ from: process.env.MAIL_FROM!, to: para, subject: asunto, html });
      if (!error) return;
      console.error(`[correo] intento ${intento} falló:`, error.message);
    } catch (e) {
      console.error(`[correo] intento ${intento} falló:`, (e as Error).message);
    }
  }
}

/** Usuarios vigentes con rol vigente que tenga el permiso en RolesPermisos, más los de rol Administrador. */
async function correosPorPermiso(permiso: string): Promise<string[]> {
  const { data: rp } = await db.from("RolesPermisos").select("IdRol").eq("Permiso", permiso);
  const { data: roles } = await db.from("Roles").select("IdRol,NombreRol").eq("IdEstado", 1);
  const conPermiso = new Set((rp ?? []).map((r: any) => r.IdRol as number));
  const ids = (roles ?? []).filter((r: any) => r.NombreRol === "Administrador" || conPermiso.has(r.IdRol)).map((r: any) => r.IdRol as number);
  if (!ids.length) return [];
  const { data } = await db.from("UsuariosRoles")
    .select("Usuarios!UsuariosRoles_IdUsuario_fkey!inner(Correo,IdEstado)")
    .eq("IdEstado", 1).in("IdRol", ids).eq("Usuarios.IdEstado", 1);
  return [...new Set((data ?? []).map((r: any) => r.Usuarios.Correo as string))];
}

export async function notificarEnviada(numero: number, solicitante: string, bodega: string) {
  const para = await correosPorPermiso("solicitudes.gestionar");
  const url = `${process.env.APP_URL ?? ""}/solicitudes`;
  await enviar(para, `Nueva solicitud #${numero} pendiente de aprobación`,
    `<p>${esc(solicitante)} envió la solicitud <b>#${numero}</b> para la bodega <b>${esc(bodega)}</b>.</p><p><a href="${esc(url)}">Revisar solicitudes</a></p>`);
}

export async function notificarResuelta(numero: number, correo: string, aprobada: boolean) {
  const url = `${process.env.APP_URL ?? ""}/solicitudes`;
  await enviar([correo], `Solicitud #${numero} ${aprobada ? "aprobada" : "rechazada"}`,
    `<p>Su solicitud <b>#${numero}</b> fue <b>${aprobada ? "aprobada" : "rechazada"}</b>.${aprobada ? " Al recibir los productos, márquela como recepcionada." : ""}</p><p><a href="${esc(url)}">Ver solicitudes</a></p>`);
}
