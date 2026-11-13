/**
 * Política de claves: una sola lista de reglas. `validarPolitica` (servidor) devuelve el primer mensaje que falla y
 * `requisitosClave` (pantalla) muestra todas con su estado, así lo que se ve es exactamente lo que se exige.
 */
const REGLAS: { texto: string; error: string; cumple: (pw: string) => boolean; soloSiFalla?: boolean }[] = [
  { texto: "Al menos 12 caracteres", error: "La clave debe tener al menos 12 caracteres", cumple: (pw) => pw.length >= 12 },
  { texto: "Una letra minúscula", error: "Debe incluir una minúscula", cumple: (pw) => /[a-z]/.test(pw) },
  { texto: "Una letra mayúscula", error: "Debe incluir una mayúscula", cumple: (pw) => /[A-Z]/.test(pw) },
  { texto: "Un número", error: "Debe incluir un número", cumple: (pw) => /\d/.test(pw) },
  { texto: "Un símbolo (por ejemplo ! ? # $ %)", error: "Debe incluir un símbolo", cumple: (pw) => /[^A-Za-z0-9]/.test(pw) },
  { texto: "Como máximo 128 caracteres", error: "La clave es demasiado larga", cumple: (pw) => pw.length <= 128, soloSiFalla: true },
];

export function validarPolitica(pw: string): string | null {
  // El largo máximo se informa antes que los demás (como siempre), pero después del mínimo.
  if (pw.length < 12) return REGLAS[0].error;
  if (pw.length > 128) return REGLAS[5].error;
  return REGLAS.find((r) => !r.cumple(pw))?.error ?? null;
}

/** `soloSiFalla`: la pantalla lo muestra únicamente cuando no se cumple (un «máximo» en verde antes de escribir confunde). */
export function requisitosClave(pw: string): { texto: string; cumple: boolean; soloSiFalla: boolean }[] {
  return REGLAS.map((r) => ({ texto: r.texto, cumple: r.cumple(pw), soloSiFalla: !!r.soloSiFalla }));
}
