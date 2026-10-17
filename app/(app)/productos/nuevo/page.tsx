import { requerirPaginaPermiso } from "@/lib/auth/session";
import { tienePermiso } from "@/lib/auth/permisos";
import { cargarCatalogo, cargarUnidades } from "@/lib/catalogo-nombres";
import { href, texto, type Contexto, type Params } from "../comun";
import { VistaCrear } from "../vista-formulario";

/** Crear producto (ruta propia, como /compras/nueva): solo con «productos.gestionar»; Volver conserva página y filtros del listado. */
export default async function NuevoProductoPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sesion = await requerirPaginaPermiso("productos.gestionar");
  const sp = await searchParams;
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q: texto(sp.q), estado: texto(sp.estado) };
  const [unidades, formatos] = await Promise.all([cargarUnidades(), cargarCatalogo("Formatos")]);
  const ctx: Contexto = {
    sp, base, volverListado: href(base), puedeGestionar: true,
    puedeVerCompras: tienePermiso(sesion.permisos, "compras.ver"),
    unidades, formatos,
    nombreUnidad: new Map(unidades.map((i) => [i.Codigo, i.Nombre])),
    nombreFormato: new Map(formatos.map((i) => [i.Codigo, i.Nombre])),
  };
  return <VistaCrear ctx={ctx} />;
}
