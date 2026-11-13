/**
 * Envío de avisos push, sin saber de web-push ni de Supabase: recibe el enviador y el borrado como dependencias,
 * así se prueba con falsos (`push.ts` conecta los reales). Nunca lanza: un fallo de push no debe afectar a quien lo pidió.
 */
export type Suscripcion = { endpoint: string; p256dh: string; auth: string };
export type AvisoPush = { titulo: string; cuerpo: string; url: string; tag: string };
/** Envía un aviso a una suscripción. Si falla, lanza un error que puede traer `statusCode` (el del servicio de push). */
export type EnviadorPush = (s: Suscripcion, aviso: AvisoPush) => Promise<unknown>;

/** El servicio de push responde 404 o 410 cuando la suscripción ya no existe (el usuario revocó el permiso o desinstaló). */
const esVencida = (e: unknown) => {
  const c = (e as { statusCode?: number } | null)?.statusCode;
  return c === 404 || c === 410;
};

export async function enviarAvisos(
  subs: Suscripcion[], aviso: AvisoPush, enviar: EnviadorPush, quitar: (endpoint: string) => Promise<void>,
): Promise<{ enviados: number; quitadas: number; fallidos: number }> {
  const r = { enviados: 0, quitadas: 0, fallidos: 0 };
  await Promise.all(subs.map(async (s) => {
    try {
      await enviar(s, aviso);
      r.enviados++;
    } catch (e) {
      if (!esVencida(e)) { r.fallidos++; return; }
      try {
        await quitar(s.endpoint);
        r.quitadas++;
      } catch {
        r.fallidos++; // no se pudo limpiar: se reintentará en el próximo aviso
      }
    }
  }));
  return r;
}
