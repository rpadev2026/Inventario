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

/** Cuerpo y dígito verificador sin ceros a la izquierda: un RUT tiene una sola forma canónica (01234567-4 es 1234567-4). */
function partes(rut: string): { cuerpo: string; dv: string } {
  const l = limpiarRut(rut);
  return { cuerpo: l.slice(0, -1).replace(/^0+/, ""), dv: l.slice(-1) };
}

export function validarRut(rut: string): boolean {
  const { cuerpo, dv } = partes(rut);
  if (!/^\d{7,8}$/.test(cuerpo) || !/^[\dK]$/.test(dv)) return false;
  return dvRut(cuerpo) === dv;
}

/** Normaliza a formato 12345678-9 (sin puntos ni ceros a la izquierda): es la forma que se guarda y se compara. */
export function normalizarRut(rut: string): string {
  const { cuerpo, dv } = partes(rut);
  return `${cuerpo}-${dv}`;
}
