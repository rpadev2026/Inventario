import { requerirPaginaPermiso } from "@/lib/auth/session";
import { href, texto, type Contexto, type Params } from "../comun";
import { VistaCrear } from "../vista-crear";

/** Crear proveedor (ruta propia, como /compras/nueva): solo con «proveedores.gestionar»; Volver conserva página y filtros del listado. */
export default async function NuevoProveedorPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requerirPaginaPermiso("proveedores.gestionar");
  const sp = await searchParams;
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q: texto(sp.q), estado: texto(sp.estado) };
  const ctx: Contexto = { sp, base, volverListado: href(base), rutaVolver: null, puedeGestionar: true };
  return <VistaCrear ctx={ctx} />;
}
