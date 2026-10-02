export function validarPolitica(pw: string): string | null {
  if (pw.length < 12) return "La clave debe tener al menos 12 caracteres";
  if (pw.length > 128) return "La clave es demasiado larga";
  if (!/[a-z]/.test(pw)) return "Debe incluir una minúscula";
  if (!/[A-Z]/.test(pw)) return "Debe incluir una mayúscula";
  if (!/\d/.test(pw)) return "Debe incluir un número";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Debe incluir un símbolo";
  return null;
}
