import { db } from "@/lib/db/supabase";
import { requerirPaginaAdmin } from "@/lib/auth/session";
import { href, texto, type Contexto, type Params } from "../comun";
import { VistaCrear } from "../vista-formulario";

/** Crear usuario (ruta propia, como /compras/nueva): solo el Administrador; Volver conserva página y filtros del listado. */
export default async function NuevoUsuarioPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sesion = await requerirPaginaAdmin();
  const sp = await searchParams;
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q: texto(sp.q), estado: texto(sp.estado) };
  const { data: rolesVigentes } = await db.from("Roles").select("IdRol,NombreRol").eq("IdEstado", 1).order("NombreRol");
  const ctx: Contexto = { sp, base, volverListado: href(base), uidActual: sesion.uid, roles: rolesVigentes ?? [] };
  return <VistaCrear ctx={ctx} />;
}
