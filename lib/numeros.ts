/** Deja solo los dígitos 0-9. */
export function soloDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

/** Para usar al teclear: dígitos y, como mucho, un separador (`,` o `.`) con hasta `decimales` decimales. */
export function filtrarDecimal(s: string, decimales: number): string {
  let ent = "";
  let sep = "";
  let dec = "";
  for (const c of s) {
    if (c >= "0" && c <= "9") {
      if (sep) { if (dec.length < decimales) dec += c; } else ent += c;
    } else if (c === "," || c === ".") {
      if (sep) break;
      sep = c;
    }
  }
  return ent + sep + dec;
}

/** Para precios en pesos: el punto se descarta (separador de miles, «1.500» = 1500) y la coma es el decimal. */
export function filtrarDecimalComa(s: string, decimales: number): string {
  return filtrarDecimal(s.replace(/\./g, ""), decimales);
}

/** Para usar al teclear el precio: hasta 2 decimales. */
export function filtrarDecimal2(s: string): string {
  return filtrarDecimal(s, 2);
}

/** Cantidad con hasta 3 decimales (coma o punto), mayor que 0; `null` si no cumple `^\d+([.,]\d{1,3})?$` o es 0. */
export function parseCantidad(s: string): number | null {
  if (!/^\d+([.,]\d{1,3})?$/.test(s)) return null;
  const n = Number(s.replace(",", "."));
  return n > 0 ? n : null;
}

/** Número con hasta 2 decimales (coma o punto); `null` si no cumple `^\d+([.,]\d{1,2})?$`. */
export function parseDecimal2(s: string): number | null {
  if (!/^\d+([.,]\d{1,2})?$/.test(s)) return null;
  return Number(s.replace(",", "."));
}
