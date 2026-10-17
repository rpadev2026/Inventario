import { tienePermiso } from "./auth/permisos";

/**
 * El costo de compra (último precio de factura, con IVA) solo lo usa quien arma recetas (costo del plato). Los buscadores de productos
 * los abre también quien solo crea solicitudes (rol Solicitante), que no puede ver productos ni facturas: a ese le llega sin costo.
 */
export const PERMISOS_COSTO_COMPRA = ["recetas.gestionar"];

export function costoCompraVisible(costo: number | string | null, permisos: readonly string[]): number | null {
  return costo === null || !tienePermiso(permisos, ...PERMISOS_COSTO_COMPRA) ? null : Number(costo);
}
