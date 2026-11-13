import "server-only";
import webpush from "web-push";
import { db } from "@/lib/db/supabase";
import { enviarAvisos, type AvisoPush, type Suscripcion } from "./cola-push";

type Fila = { Endpoint: string; P256dh: string; Auth: string };
const aSuscripcion = (f: Fila): Suscripcion => ({ endpoint: f.Endpoint, p256dh: f.P256dh, auth: f.Auth });

/** Sin las tres variables VAPID la aplicación funciona igual: simplemente no hay avisos push. */
export function pushConfigurado(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

/** Envía el aviso a esas suscripciones y borra las vencidas. Nunca lanza: un fallo de push no debe afectar a la operación de negocio. */
async function enviar(leer: () => PromiseLike<{ data: Fila[] | null; error: { message: string } | null }>, aviso: AvisoPush): Promise<void> {
  if (!pushConfigurado()) return;
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    const { data, error } = await leer();
    if (error || !data) { console.error("[push] no se pudieron leer las suscripciones:", error?.message); return; }
    const r = await enviarAvisos(
      data.map(aSuscripcion), aviso,
      // TTL 24 h: un aviso viejo de una solicitud ya resuelta no debe llegar días después a un teléfono que estuvo apagado.
      (s, a) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(a), { TTL: 86_400, timeout: 15_000 }),
      async (endpoint) => { await db.rpc("quitar_suscripcion_push", { p_endpoint: endpoint }); },
    );
    if (r.fallidos) console.error(`[push] ${r.fallidos} aviso(s) no se pudieron enviar`);
  } catch (e) {
    console.error("[push] error inesperado:", (e as Error).message);
  }
}

/** Una solicitud pasó a Enviada: avisa a quienes la atienden (permiso solicitudes.gestionar), menos a quien la envió. */
export async function notificarPushEnviada(numero: number, solicitante: string, bodega: string, token: string, idSolicitante: number): Promise<void> {
  await enviar(
    async () => db.rpc("suscripciones_push_permiso", { p_permiso: "solicitudes.gestionar", p_excluir: idSolicitante }),
    { titulo: `Nueva solicitud #${numero}`, cuerpo: `${solicitante} envió una solicitud para ${bodega}.`, url: `/solicitudes/${token}`, tag: `solicitud-${token}` },
  );
}

/** Se aprobó o rechazó: avisa al solicitante. */
export async function notificarPushResuelta(numero: number, idSolicitante: number, token: string, aprobada: boolean, motivo?: string): Promise<void> {
  await enviar(
    async () => db.rpc("suscripciones_push_usuarios", { p_usuarios: [idSolicitante] }),
    {
      titulo: `Solicitud #${numero} ${aprobada ? "aprobada" : "rechazada"}`,
      cuerpo: aprobada ? "Ya puede recepcionar los productos cuando lleguen." : motivo ? `Motivo: ${motivo}` : "Revise el detalle de la solicitud.",
      url: `/solicitudes/${token}`, tag: `solicitud-${token}`,
    },
  );
}
