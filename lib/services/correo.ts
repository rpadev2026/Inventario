import "server-only";
import { Resend } from "resend";
import { after } from "next/server";
import { db, nulo } from "@/lib/db/supabase";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/**
 * Deja el correo en la cola (tabla CorreosPendientes) y no espera al proveedor. Nunca lanza: un fallo de correo
 * no debe revertir la operación de negocio. `clave` evita encolar dos veces el mismo aviso.
 */
async function encolar(para: string[], asunto: string, html: string, clave: string) {
  if (!para.length) return;
  const { error } = await db.from("CorreosPendientes").insert({ Para: para, Asunto: asunto, Html: html, ClaveUnica: clave });
  if (error && error.code !== "23505") console.error("[correo] no se pudo encolar:", error.code);
  // El envío ocurre después de responder; los fallos quedan en la cola para reintentarse (ver /api/correos/procesar).
  after(() => procesarCola());
}

/** Envía los correos vencidos de la cola. Sin RESEND_API_KEY no toca nada: quedan pendientes. */
export async function procesarCola(max = 20): Promise<{ enviados: number; fallidos: number }> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !process.env.MAIL_FROM) return { enviados: 0, fallidos: 0 };
  const { data, error } = await db.rpc("reclamar_correos", { p_max: max });
  if (error) { console.error("[correo] no se pudo leer la cola:", error.code); return { enviados: 0, fallidos: 0 }; }
  const resend = new Resend(key);
  let enviados = 0, fallidos = 0;
  for (const c of data ?? []) {
    let motivo: string | null = null;
    try {
      // La clave de idempotencia evita un duplicado si el envío salió pero no alcanzamos a registrarlo.
      const { error: e } = await resend.emails.send(
        { from: process.env.MAIL_FROM, to: c.Para, subject: c.Asunto, html: c.Html },
        { idempotencyKey: `correo-${c.IdCorreo}` },
      );
      if (e) motivo = e.message;
    } catch (e) {
      motivo = (e as Error).message;
    }
    if (motivo) console.error(`[correo] #${c.IdCorreo} intento ${c.Intentos} falló:`, motivo);
    await db.rpc("resolver_correo", { p_id: c.IdCorreo, p_ok: motivo === null, p_error: motivo ?? nulo });
    if (motivo === null) enviados++; else fallidos++;
  }
  return { enviados, fallidos };
}

/** Usuarios vigentes con rol vigente que tenga el permiso en RolesPermisos, más los de rol Administrador. */
async function correosPorPermiso(permiso: string): Promise<string[]> {
  const { data: rp } = await db.from("RolesPermisos").select("IdRol").eq("Permiso", permiso);
  const { data: roles } = await db.from("Roles").select("IdRol,NombreRol").eq("IdEstado", 1);
  const conPermiso = new Set((rp ?? []).map((r) => r.IdRol));
  const ids = (roles ?? []).filter((r) => r.NombreRol === "Administrador" || conPermiso.has(r.IdRol)).map((r) => r.IdRol);
  if (!ids.length) return [];
  const { data } = await db.from("UsuariosRoles")
    .select("Usuarios!UsuariosRoles_IdUsuario_fkey!inner(Correo,IdEstado)")
    .eq("IdEstado", 1).in("IdRol", ids).eq("Usuarios.IdEstado", 1);
  return [...new Set((data ?? []).map((r) => r.Usuarios.Correo))];
}

export async function notificarEnviada(numero: number, solicitante: string, bodega: string) {
  const para = await correosPorPermiso("solicitudes.gestionar");
  const url = `${process.env.APP_URL ?? ""}/solicitudes`;
  await encolar(para, `Nueva solicitud #${numero} pendiente de aprobación`,
    `<p>${esc(solicitante)} envió la solicitud <b>#${numero}</b> para la bodega <b>${esc(bodega)}</b>.</p><p><a href="${esc(url)}">Revisar solicitudes</a></p>`,
    `enviada:${numero}`);
}

export async function notificarResuelta(numero: number, correo: string, aprobada: boolean) {
  const url = `${process.env.APP_URL ?? ""}/solicitudes`;
  await encolar([correo], `Solicitud #${numero} ${aprobada ? "aprobada" : "rechazada"}`,
    `<p>Su solicitud <b>#${numero}</b> fue <b>${aprobada ? "aprobada" : "rechazada"}</b>.${aprobada ? " Al recibir los productos, márquela como recepcionada." : ""}</p><p><a href="${esc(url)}">Ver solicitudes</a></p>`,
    `resuelta:${numero}:${aprobada ? "aprobada" : "rechazada"}`);
}
