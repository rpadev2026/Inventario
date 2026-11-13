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
