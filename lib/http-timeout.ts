/**
 * Límite de tiempo para las llamadas a servicios externos (Fudo, Bsale, Supabase, Resend): sin él, un servicio colgado deja la
 * petición (y al usuario) esperando indefinidamente. Sin dependencias de Next ni del entorno: se prueba en `http-timeout.test.ts`.
 */
export class TiempoAgotado extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "TiempoAgotado";
  }
}

const legible = (ms: number) => (ms >= 1000 ? `${Math.round(ms / 1000)} s` : `${ms} ms`);

/**
 * Envuelve un `fetch`: cada petición se aborta a los `ms` milisegundos (también si se demora leyendo la respuesta) y falla con
 * `TiempoAgotado`. Si quien llama ya pasó su propia `signal`, cualquiera de las dos cancela.
 */
export function conTimeout(f: typeof fetch, ms: number, servicio: string): typeof fetch {
  return async (input, init) => {
    const limite = AbortSignal.timeout(ms);
    const propia = init?.signal ?? undefined;
    const signal = propia ? AbortSignal.any([propia, limite]) : limite;
    try {
      return await f(input, { ...init, signal });
    } catch (e) {
      if (limite.aborted && !propia?.aborted) throw new TiempoAgotado(`${servicio} no respondió en ${legible(ms)}`);
      throw e;
    }
  };
}

/** Para SDK que no aceptan `signal` (p. ej. Resend): la espera se corta a los `ms`, aunque la operación siga por detrás. */
export function conLimite<T>(promesa: Promise<T>, ms: number, servicio: string): Promise<T> {
  let reloj: ReturnType<typeof setTimeout>;
  const limite = new Promise<never>((_, rechazar) => { reloj = setTimeout(() => rechazar(new TiempoAgotado(`${servicio} no respondió en ${legible(ms)}`)), ms); });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(reloj));
}
