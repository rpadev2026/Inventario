import { requerirPaginaPermiso } from "@/lib/auth/session";
import type { Contexto } from "../../../proveedores/comun";
import { VistaCrear } from "../../../proveedores/vista-crear";

/**
 * Crear un proveedor desde «Nueva factura». La ruta misma dice de dónde se viene, así que la URL no lleva parámetros (antes
 * «?volver=/compras/nueva»): al guardar vuelve a la factura con el proveedor ya elegido, y Volver también.
 */
export default async function CrearProveedorDesdeFacturaPage() {
  await requerirPaginaPermiso("compras.registrar");
  await requerirPaginaPermiso("proveedores.gestionar");
  const ctx: Contexto = { sp: {}, base: {}, volverListado: "/proveedores", puedeGestionar: true };
  return <VistaCrear ctx={ctx} origen="/compras/nueva" />;
}
