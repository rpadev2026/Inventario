import { redirect } from "next/navigation";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { tienePermiso } from "@/lib/auth/permisos";
import { cargarCatalogo, cargarUnidades } from "@/lib/catalogo-nombres";
import type { Producto } from "./form";
import { tokenValido } from "@/lib/token";
import { href, texto, type Contexto, type Params } from "./comun";
import { VistaEditar } from "./vista-formulario";
import { VistaDetalle } from "./vista-detalle";
import { VistaListado } from "./vista-listado";

/** Despacha a la vista que corresponde según la URL (crear, editar, ver o listado); cada vista vive en su archivo. */
export default async function ProductosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sesion = await requerirPaginaPermiso("productos.ver");
  const puedeGestionar = tienePermiso(sesion.permisos, "productos.gestionar");
  const sp = await searchParams;
  // URL antigua desde la factura («?volver=/compras/nueva»): ahora tiene su propia ruta, sin parámetros.
  if (texto(sp.volver) === "/compras/nueva") redirect("/compras/nueva/producto");
  // URL antigua «?crear=1»: la creación tiene su propia ruta (como /compras/nueva), conservando página y filtros.
  if (sp.crear === "1") redirect(href({ pagina: texto(sp.pagina), tam: texto(sp.tam), q: texto(sp.q), estado: texto(sp.estado), crear: "1" }));
  // Editar solo con «productos.gestionar» (la acción del servidor lo exige igualmente).
  // Un token inválido se ignora y se muestra el listado.
  const idEditar = puedeGestionar ? tokenValido(texto(sp.editar)) : undefined;
  const idVer = idEditar ? undefined : tokenValido(texto(sp.ver));

  // Parámetros del listado (página, tamaño y filtros) que se conservan al ir a una vista y volver.
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q: texto(sp.q), estado: texto(sp.estado) };
  const [unidades, formatos] = await Promise.all([cargarUnidades(), cargarCatalogo("Formatos")]);
  const ctx: Contexto = {
    sp, base, volverListado: href(base), puedeGestionar,
    puedeVerCompras: tienePermiso(sesion.permisos, "compras.ver"),
    unidades, formatos,
    nombreUnidad: new Map(unidades.map((i) => [i.Codigo, i.Nombre])),
    nombreFormato: new Map(formatos.map((i) => [i.Codigo, i.Nombre])),
  };

  const idPanel = idEditar ?? idVer;
  const { data: sel } = idPanel
    ? await db.from("Productos").select("*").eq("Token", idPanel).maybeSingle<Producto>()
    : { data: null };
  if (idEditar && sel) return <VistaEditar ctx={ctx} sel={sel} />;
  if (idVer && sel) return <VistaDetalle ctx={ctx} sel={sel} />;
  return <VistaListado ctx={ctx} />;
}
