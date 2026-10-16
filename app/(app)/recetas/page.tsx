import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { tienePermiso } from "@/lib/auth/permisos";
import { cargarUnidades } from "@/lib/catalogo-nombres";
import { tokenValido } from "@/lib/token";
import { href, texto, type Contexto, type Params } from "./comun";
import { VistaFormulario } from "./vista-formulario";
import { VistaDetalle } from "./vista-detalle";
import { VistaListado } from "./vista-listado";

/** Despacha a la vista que corresponde según la URL (crear/editar, ver o listado); cada vista vive en su archivo. */
export default async function RecetasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sesion = await requerirPaginaPermiso("recetas.ver");
  const puedeGestionar = tienePermiso(sesion.permisos, "recetas.gestionar");
  const sp = await searchParams;
  // Crear/editar solo con «recetas.gestionar» (la acción del servidor lo exige igualmente).
  const crear = puedeGestionar && sp.crear === "1";
  const idEditar = puedeGestionar && !crear ? tokenValido(texto(sp.editar)) : undefined;
  const idVer = crear || idEditar ? undefined : tokenValido(texto(sp.ver));

  // Parámetros del listado (página, tamaño y filtros) que se conservan al ir a una vista y volver.
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q: texto(sp.q), estado: texto(sp.estado) };
  const unidades = await cargarUnidades();
  const ctx: Contexto = {
    sp, base, volverListado: href(base), puedeGestionar, unidades,
    nombreUnidad: new Map(unidades.map((u) => [u.Codigo, u.Nombre])),
  };

  if (crear || idEditar) {
    const { data: rec } = idEditar
      ? await db.from("Recetas").select("*").eq("Token", idEditar).maybeSingle()
      : { data: null };
    if (crear || rec) return <VistaFormulario ctx={ctx} crear={crear} idEditar={rec?.IdReceta} rec={rec} />;
  }
  if (idVer) {
    const { data: rec } = await db.from("Recetas").select("*").eq("Token", idVer).maybeSingle();
    if (rec) return <VistaDetalle ctx={ctx} rec={rec} />;
  }
  return <VistaListado ctx={ctx} />;
}
