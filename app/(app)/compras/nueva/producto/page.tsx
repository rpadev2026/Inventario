import { requerirPaginaPermiso } from "@/lib/auth/session";
import { tienePermiso } from "@/lib/auth/permisos";
import { cargarCatalogo, cargarUnidades } from "@/lib/catalogo-nombres";
import type { Contexto } from "../../../productos/comun";
import { VistaCrear } from "../../../productos/vista-formulario";

/**
 * Crear un producto desde «Nueva factura». La ruta misma dice de dónde se viene, así que la URL no lleva parámetros (antes
 * «?volver=/compras/nueva»): al guardar vuelve a la factura con el producto ya elegido, y Volver también.
 */
export default async function CrearProductoDesdeFacturaPage() {
  const sesion = await requerirPaginaPermiso("compras.registrar");
  await requerirPaginaPermiso("productos.gestionar");
  const [unidades, formatos] = await Promise.all([cargarUnidades(), cargarCatalogo("Formatos")]);
  const ctx: Contexto = {
    sp: {}, base: {}, volverListado: "/productos", puedeGestionar: true,
    puedeVerCompras: tienePermiso(sesion.permisos, "compras.ver"),
    unidades, formatos,
    nombreUnidad: new Map(unidades.map((i) => [i.Codigo, i.Nombre])),
    nombreFormato: new Map(formatos.map((i) => [i.Codigo, i.Nombre])),
  };
  return <VistaCrear ctx={ctx} origen="/compras/nueva" />;
}
