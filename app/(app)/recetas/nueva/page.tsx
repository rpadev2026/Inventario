import { requerirPaginaPermiso } from "@/lib/auth/session";
import { cargarUnidades } from "@/lib/catalogo-nombres";
import { href, texto, type Contexto, type Params } from "../comun";
import { VistaFormulario } from "../vista-formulario";

/** Crear receta (ruta propia, como /compras/nueva): solo con «recetas.gestionar»; Volver conserva página y filtros del listado. */
export default async function NuevaRecetaPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requerirPaginaPermiso("recetas.gestionar");
  const sp = await searchParams;
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q: texto(sp.q), estado: texto(sp.estado) };
  const unidades = await cargarUnidades();
  const ctx: Contexto = {
    sp, base, volverListado: href(base), puedeGestionar: true, unidades,
    nombreUnidad: new Map(unidades.map((u) => [u.Codigo, u.Nombre])),
  };
  return <VistaFormulario ctx={ctx} crear idEditar={undefined} rec={null} />;
}
