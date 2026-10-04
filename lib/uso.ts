const miles = new Intl.NumberFormat("es-CL");

/** «12 facturas», «1 factura», «3 comunas (1 vigente)». */
export function textoUso(total: number, singular: string, plural: string, vigentes?: number): string {
  const base = `${miles.format(total)} ${total === 1 ? singular : plural}`;
  return vigentes === undefined ? base : `${base} (${miles.format(vigentes)} ${vigentes === 1 ? "vigente" : "vigentes"})`;
}
