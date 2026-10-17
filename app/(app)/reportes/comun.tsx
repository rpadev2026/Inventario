/** Formatos que comparten los reportes. */
const cantidad = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 });
const pesos = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 2 });
const costo = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 6 });

export const fmtCantidad = (n: number) => cantidad.format(n);
export const fmtPesos = (n: number) => pesos.format(n);
export const fmtCosto = (n: number) => costo.format(n);
