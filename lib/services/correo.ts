import "server-only";
import { Resend } from "resend";
import { after } from "next/server";
import { db, nulo } from "@/lib/db/supabase";
import { procesarColaCon, type ColaCorreos, type Enviador } from "./cola-correos";

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

/** La cola real: las funciones SQL `reclamar_correos` y `resolver_correo`. */
const colaSupabase: ColaCorreos = {
  async reclamar(max) {
    const { data, error } = await db.rpc("reclamar_correos", { p_max: max });
    if (error) throw new Error(error.code ?? error.message);
    return (data ?? []).map((c) => ({ id: c.IdCorreo, para: c.Para, asunto: c.Asunto, html: c.Html, intentos: c.Intentos }));
  },
  async resolver(id, motivoFallo) {
    const { error } = await db.rpc("resolver_correo", { p_id: id, p_ok: motivoFallo === null, p_error: motivoFallo ?? nulo });
    if (error) throw new Error(error.code ?? error.message);
  },
};

/** El enviador real: Resend. La clave de idempotencia evita un duplicado si el envío salió pero no alcanzamos a registrarlo. */
const enviadorResend = (key: string, from: string): Enviador => {
  const resend = new Resend(key);
  return async (c) => {
    const { error } = await resend.emails.send({ from, to: c.para, subject: c.asunto, html: c.html }, { idempotencyKey: `correo-${c.id}` });
    return error ? error.message : null;
  };
};

/** Envía los correos vencidos de la cola. Sin RESEND_API_KEY ni MAIL_FROM no toca nada: quedan pendientes. */
export async function procesarCola(max = 20): Promise<{ enviados: number; fallidos: number }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) return { enviados: 0, fallidos: 0 };
  return procesarColaCon(colaSupabase, enviadorResend(key, from), max);
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
