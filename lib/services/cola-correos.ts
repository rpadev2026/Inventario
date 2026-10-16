/**
 * Lógica de la cola de correos, sin saber de Supabase ni de Resend: recibe la cola y el enviador como dependencias.
 * Así se prueba (reintentos, fallos parciales, errores) con versiones falsas; `correo.ts` conecta las reales.
 */
export type CorreoPendiente = { id: number; para: string[]; asunto: string; html: string; intentos: number };

export type ColaCorreos = {
  /** Toma (y arrienda) hasta `max` correos vencidos. */
  reclamar(max: number): Promise<CorreoPendiente[]>;
  /** Registra el resultado: `motivoFallo` null = enviado; con texto = falló (la base decide el reintento). */
  resolver(id: number, motivoFallo: string | null): Promise<void>;
};

/** Envía un correo: devuelve el motivo del fallo, o null si salió. Puede lanzar: se trata como fallo. */
export type Enviador = (correo: CorreoPendiente) => Promise<string | null>;

/** Envía los correos vencidos de la cola. Nunca lanza: un fallo de correo no debe afectar a quien lo pidió. */
export async function procesarColaCon(cola: ColaCorreos, enviar: Enviador, max = 20): Promise<{ enviados: number; fallidos: number }> {
  let correos: CorreoPendiente[];
  try {
    correos = await cola.reclamar(max);
  } catch (e) {
    console.error("[correo] no se pudo leer la cola:", (e as Error).message);
    return { enviados: 0, fallidos: 0 };
  }
  let enviados = 0, fallidos = 0;
  for (const c of correos) {
    let motivo: string | null;
    try {
      motivo = await enviar(c);
    } catch (e) {
      motivo = (e as Error).message;
    }
    if (motivo) console.error(`[correo] #${c.id} intento ${c.intentos} falló:`, motivo);
    try {
      await cola.resolver(c.id, motivo);
    } catch (e) {
      console.error(`[correo] #${c.id}: no se pudo registrar el resultado:`, (e as Error).message);
    }
    if (motivo === null) enviados++; else fallidos++;
  }
  return { enviados, fallidos };
}
