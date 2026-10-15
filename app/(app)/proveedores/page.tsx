import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { tienePermiso } from "@/lib/auth/permisos";
import { rutaVolverSegura } from "@/lib/volver";
import type { Proveedor } from "./forms";
import { entero, href, texto, type Contexto, type Params } from "./comun";
import { VistaCrear } from "./vista-crear";
import { VistaEditar } from "./vista-editar";
import { VistaDetalle } from "./vista-detalle";
import { VistaListado } from "./vista-listado";

/** Despacha a la vista que corresponde según la URL (crear, editar, ver o listado); cada vista vive en su archivo. */
export default async function ProveedoresPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sesion = await requerirPaginaPermiso("proveedores.ver");
  const puedeGestionar = tienePermiso(sesion.permisos, "proveedores.gestionar");
  const sp = await searchParams;
  const rutaVolver = rutaVolverSegura(texto(sp.volver));
  // Crear/editar solo con «proveedores.gestionar» (las acciones del servidor lo exigen igualmente).
  // Venir desde una factura (?volver=) abre directo la vista Crear.
  const crear = puedeGestionar && (sp.crear === "1" || !!rutaVolver);
  const idEditar = puedeGestionar && !crear ? entero(sp.editar) : undefined;
  const idVer = crear || idEditar ? undefined : entero(sp.ver);

  // Parámetros del listado (página, tamaño y filtros) que se conservan al ir a una vista y volver.
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q: texto(sp.q), estado: texto(sp.estado) };
  const ctx: Contexto = { sp, base, volverListado: href(base), rutaVolver, puedeGestionar };

  if (crear) return <VistaCrear ctx={ctx} />;

  const idPanel = idEditar ?? idVer;
  const { data: sel } = idPanel
    ? await db.from("Proveedores").select("*").eq("IdProveedor", idPanel).maybeSingle<Proveedor>()
    : { data: null };
  if (idEditar && sel) return <VistaEditar ctx={ctx} sel={sel} />;
  if (idVer && sel) return <VistaDetalle ctx={ctx} sel={sel} />;
  return <VistaListado ctx={ctx} />;
}
