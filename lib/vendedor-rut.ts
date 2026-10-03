export type VendedorExistente = { IdVendedor: number; IdProveedor: number; RazonSocial: string; IdEstado: number };

/**
 * Regla: un mismo RUT de vendedor puede estar en varios proveedores, pero vigente en uno solo.
 * Recibe los registros que ya existen con ese RUT y devuelve el que lo impide: uno vigente que no sea
 * el que se está editando (`idActual`). Solo se usa cuando el registro que se guarda queda vigente.
 */
export function vendedorVigenteEnOtro(existentes: VendedorExistente[], idActual: number | undefined): VendedorExistente | undefined {
  return existentes.find((v) => v.IdEstado === 1 && v.IdVendedor !== idActual);
}
