/**
 * Cierre de sesión por inactividad. El tiempo sale de la variable de entorno `SESSION_IDLE_MINUTES` (minutos sin actividad;
 * p. ej. `SESSION_IDLE_MINUTES=2` en `.env.local`). Sin ella, o con un valor inválido, se usan 30 minutos.
 * Lógica pura: la usan `proxy.ts` (servidor), el layout (que se la pasa al navegador) y las pruebas.
 */
export const MINUTOS_DEFECTO = 30;
export const MINUTOS_MAX = 24 * 60;
/** Cada cuánto, como máximo, el servidor renueva la marca de actividad del token (evita firmar uno nuevo en cada petición). */
export const REFRESCO_MS = 10_000;

/** Minutos de inactividad permitidos: número entre 1 y 1440; cualquier otra cosa (vacío, texto, 0, negativo) toma el valor por defecto. */
export function minutosInactividad(valor: string | undefined): number {
  const n = Number((valor ?? "").trim());
  return Number.isFinite(n) && n >= 1 && n <= MINUTOS_MAX ? n : MINUTOS_DEFECTO;
}

/** Cada cuánto, como máximo, el navegador avisa al servidor que el usuario sigue activo: un tercio del límite, entre 10 y 60 s. */
export const intervaloLatidoMs = (limiteMin: number): number => Math.min(60_000, Math.max(10_000, (limiteMin * 60_000) / 3));

/** ¿Pasó el límite sin actividad? `ultimaActividadMs` y `ahoraMs` en milisegundos de época. */
export const inactiva = (ultimaActividadMs: number, ahoraMs: number, limiteMin: number): boolean =>
  ahoraMs - ultimaActividadMs > limiteMin * 60_000;
