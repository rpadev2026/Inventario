/** Lógica pura de los avisos push en el navegador (se prueba aparte; `components/app/activar-avisos.tsx` la usa). */

/** La clave pública VAPID viene en base64url; `pushManager.subscribe` la pide como bytes. */
export function claveAplicacion(base64Url: string): Uint8Array {
  const b64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

export type EstadoAvisos = "no-soportado" | "ios-sin-instalar" | "bloqueado" | "sin-configurar" | "inactivo" | "activo";

export function estadoAvisos(e: {
  soportado: boolean; esIos: boolean; instalada: boolean; permiso: NotificationPermission | "default"; configurado: boolean; suscrito: boolean;
}): EstadoAvisos {
  // En iPhone/iPad solo la app instalada en la pantalla de inicio (iOS 16.4 o superior) puede recibir push: desde Safari no existe la API.
  if (e.esIos && !e.instalada) return "ios-sin-instalar";
  if (!e.soportado) return "no-soportado";
  if (!e.configurado) return "sin-configurar";
  if (e.permiso === "denied") return "bloqueado";
  return e.permiso === "granted" && e.suscrito ? "activo" : "inactivo";
}

/**
 * Dispositivo compartido: si el navegador ya tiene una suscripción (de quien usó el equipo antes), se vuelve a guardar para el usuario
 * de la sesión actual; el servidor reasigna la fila por su endpoint. También recupera una fila que se borró por vencida. Nunca lanza.
 */
export async function reasignarSuscripcion(
  sub: { toJSON(): { endpoint?: string; keys?: { p256dh?: string; auth?: string } } } | null,
  guardar: (s: { endpoint?: string; p256dh?: string; auth?: string }) => Promise<{ ok?: true; error?: string }>,
): Promise<boolean> {
  if (!sub) return false;
  try {
    const j = sub.toJSON();
    const r = await guardar({ endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth });
    return !!r.ok;
  } catch {
    return false;
  }
}

const GENERICO = "No se pudo activar los avisos en este dispositivo. Intente nuevamente.";

/** Traduce el error del navegador al suscribirse a un mensaje que diga qué hacer (el genérico no ayuda a diagnosticar). */
export function mensajeErrorAvisos(e: unknown): string {
  const nombre = (e as { name?: string } | null)?.name;
  if (nombre === "AbortError")
    return "El navegador no pudo conectarse con su servicio de notificaciones. Si usa Brave, active «Usar servicios de Google para mensajería push» en brave://settings/privacy y reinicie el navegador; en otros, revise la conexión.";
  if (nombre === "InvalidAccessError" || nombre === "InvalidCharacterError")
    return "La clave pública de los avisos no es válida. Revise VAPID_PUBLIC_KEY en el servidor (debe copiarse completa, sin comillas ni espacios).";
  if (nombre === "NotAllowedError") return "El navegador bloqueó los avisos. Permítalos en la configuración del sitio y vuelva a intentarlo.";
  return GENERICO;
}
