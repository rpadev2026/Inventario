export function limpiarRut(rut: string): string {
  return rut.replace(/[.\s-]/g, "").toUpperCase();
}

export function dvRut(cuerpo: string): string {
  let suma = 0;
  let mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const r = 11 - (suma % 11);
  return r === 11 ? "0" : r === 10 ? "K" : String(r);
}

export function validarRut(rut: string): boolean {
  const l = limpiarRut(rut);
  if (!/^\d{7,8}[\dK]$/.test(l)) return false;
  return dvRut(l.slice(0, -1)) === l.slice(-1);
}

/** Normaliza a formato 12345678-9 (sin puntos). */
export function normalizarRut(rut: string): string {
  const l = limpiarRut(rut);
  return `${l.slice(0, -1)}-${l.slice(-1)}`;
}
