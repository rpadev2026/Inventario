/**
 * IP del cliente para el límite de intentos de login. `x-forwarded-for` lo escribe cada proxy AGREGANDO su valor a la derecha, y
 * el cliente puede mandar los primeros: el valor de la izquierda se puede falsificar (cada valor falso tendría su propio
 * contador). Se toma el de la derecha que agregó el primer proxy de confianza: con N proxies delante de la app es el N-ésimo
 * desde la derecha. N sale de `PROXY_CONFIABLES` (por defecto 1, un proxy/hosting delante); con 0 la cabecera se ignora porque
 * nadie de confianza la escribe. Sin una IP válida devuelve "local" (contador compartido: falla hacia el lado seguro).
 */
const IP = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]{2,45})$/;

export function ipCliente(h: Pick<Headers, "get">, saltos = Number(process.env.PROXY_CONFIABLES ?? 1)): string {
  const n = Number.isInteger(saltos) ? saltos : 1;
  if (n <= 0) return "local";
  const valores = (h.get("x-forwarded-for") ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (!valores.length) return "local";
  // Si la cadena es más corta que los proxies esperados, el valor más a la izquierda es el que agregó el primer proxy.
  const v = valores[Math.max(0, valores.length - n)].replace(/^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/, "$1"); // IPv4 con puerto
  return IP.test(v) ? v : "local";
}
