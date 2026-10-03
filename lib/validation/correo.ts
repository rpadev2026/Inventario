/** Mensaje de negocio para un correo con formato inválido (servidor y cliente). */
export const MSG_CORREO = "Ingrese un correo válido, por ejemplo nombre@dominio.cl";

// usuario: letras, números y _ + - ' separados por puntos simples; dominio: etiquetas con punto y extensión de 2+ letras.
const FORMATO = /^[A-Za-z0-9_+'-]+(\.[A-Za-z0-9_+'-]+)*@([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

/** ¿Tiene el formato usuario@dominio.ext? (sin espacios, con punto y extensión en el dominio, máx. 254 y usuario ≤ 64). */
export function esCorreoValido(correo: string): boolean {
  const i = correo.indexOf("@");
  return correo.length <= 254 && i >= 1 && i <= 64 && FORMATO.test(correo);
}
