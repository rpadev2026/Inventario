import { db } from "@/lib/db/supabase";
import { requerirPaginaAdmin } from "@/lib/auth/session";
import { entero, href, texto, type Contexto, type Params } from "./comun";
import { VistaCrear, VistaEditar } from "./vista-formulario";
import { VistaDetalle } from "./vista-detalle";
import { VistaListado } from "./vista-listado";

/** Despacha a la vista que corresponde según la URL (crear, editar, ver o listado); cada vista vive en su archivo. */
export default async function UsuariosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sesion = await requerirPaginaAdmin();
  const sp = await searchParams;
  const crear = sp.crear === "1";
  const idEditar = crear ? undefined : entero(sp.editar);
  const idVer = crear || idEditar ? undefined : entero(sp.ver);

  // Parámetros del listado (página, tamaño y filtros) que se conservan al ir a una vista y volver.
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q: texto(sp.q), estado: texto(sp.estado) };
  const { data: rolesVigentes } = await db.from("Roles").select("IdRol,NombreRol").eq("IdEstado", 1).order("NombreRol");
  const ctx: Contexto = { sp, base, volverListado: href(base), uidActual: sesion.uid, roles: rolesVigentes ?? [] };

  if (crear) return <VistaCrear ctx={ctx} />;

  const idPanel = idEditar ?? idVer;
  const { data: sel } = idPanel
    ? await db.from("Usuarios").select("IdUsuario,Rut,Nombres,Apellidos,Correo,IdEstado,FechaRegistroCreacion").eq("IdUsuario", idPanel).maybeSingle()
    : { data: null };
  if (idEditar && sel) return <VistaEditar ctx={ctx} sel={sel} />;
  if (idVer && sel) return <VistaDetalle ctx={ctx} sel={sel} />;
  return <VistaListado ctx={ctx} />;
}
