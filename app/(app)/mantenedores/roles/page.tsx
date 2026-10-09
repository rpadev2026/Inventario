import Link from "next/link";
import Aviso from "@/components/app/aviso";
import Badge from "@/components/app/badge";
import FiltrosListado from "@/components/app/filtros-listado";
import Icon from "@/components/app/icon";
import Paginador from "@/components/app/paginador";
import { db } from "@/lib/db/supabase";
import { requerirPaginaAdmin } from "@/lib/auth/session";
import { agruparPermisos } from "@/lib/auth/permisos";
import { cargarPermisos } from "@/lib/services/permisos";
import { paginar } from "@/lib/paginacion";
import { leerEstado } from "@/lib/filtro-estado";
import { filtrarRoles } from "@/lib/roles-filtro";
import FormRol, { type RolItem } from "./form-rol";
import { guardarRol } from "./actions";

type Params = Record<string, string | string[] | undefined>;
const RUTA = "/mantenedores/roles";
const entero = (v: unknown) => (typeof v === "string" && /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : undefined);
const texto = (v: string | string[] | undefined) => (typeof v === "string" && v !== "" ? v : undefined);
const AVISOS: Record<string, string> = { creado: "Rol creado correctamente", editado: "Cambios guardados correctamente" };
const estadoBadge = (e: number) => <Badge tone={e === 1 ? "ok" : "neutral"}>{e === 1 ? "Vigente" : "No vigente"}</Badge>;
const Dato = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div><div className="label-block">{titulo}</div><div>{children || "—"}</div></div>
);

/** URL de este mantenedor con solo los parámetros indicados (los undefined se omiten). */
function href(q: Record<string, string | undefined>) {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined) as [string, string][]).toString();
  return s ? `${RUTA}?${s}` : RUTA;
}

export default async function RolesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requerirPaginaAdmin();
  const [sp, catalogo] = await Promise.all([searchParams, cargarPermisos()]);
  const crear = sp.crear === "1";
  const idEditar = crear ? undefined : entero(sp.editar);
  const idVer = crear || idEditar ? undefined : entero(sp.ver);

  // Parámetros del listado (página, tamaño y filtros) que se conservan al ir a una vista y volver.
  const q = texto(sp.q);
  const estadoPedido = texto(sp.estado);
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q, estado: estadoPedido };
  const volverListado = href(base);

  // ===== Crear: solo el formulario, con Volver =====
  if (crear) {
    return (
      <section className="space-y-4">
        <div className="page-head">
          <h1 className="page-title">Crear rol</h1>
          <Link href={volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <div className="card">
          <FormRol catalogo={catalogo} accion={guardarRol} despuesDeGuardar={href({ tam: base.tam, aviso: "creado" })} />
        </div>
      </section>
    );
  }

  const [{ data: roles }, { data: rp }, { data: ur }] = await Promise.all([
    db.from("Roles").select("IdRol,NombreRol,DetalleRol,IdEstado,EsBase").order("IdRol"),
    db.from("RolesPermisos").select("IdRol,Permiso"),
    db.from("UsuariosRoles").select("IdRol").eq("IdEstado", 1),
  ]);
  const todos = (roles ?? []) as RolItem[];
  const permisosDe = (id: number) => (rp ?? []).filter((x) => x.IdRol === id).map((x) => x.Permiso as string);
  const usuariosDe = (id: number) => (ur ?? []).filter((x) => x.IdRol === id).length;
  const cantPermisos = (r: RolItem) => (r.NombreRol === "Administrador" ? "Todos" : String(permisosDe(r.IdRol).length));

  // ===== Editar: el formulario del rol con la matriz de permisos, con Volver =====
  const enEdicion = idEditar ? todos.find((r) => r.IdRol === idEditar) : undefined;
  if (enEdicion) {
    return (
      <section className="space-y-4">
        <div className="page-head">
          <h1 className="page-title">Editar rol</h1>
          <Link href={volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <div className="card">
          <FormRol key={enEdicion.IdRol} catalogo={catalogo} rol={enEdicion} permisos={permisosDe(enEdicion.IdRol)} accion={guardarRol}
            despuesDeGuardar={href({ ...base, aviso: "editado" })} />
        </div>
      </section>
    );
  }

  // ===== Ver: datos del rol y sus permisos por módulo (solo lectura) =====
  const enVista = idVer ? todos.find((r) => r.IdRol === idVer) : undefined;
  if (enVista) {
    const asignados = new Set(permisosDe(enVista.IdRol));
    const esAdmin = enVista.NombreRol === "Administrador";
    return (
      <section className="space-y-6">
        <div className="page-head">
          <h1 className="page-title">{enVista.NombreRol}</h1>
          <Link href={volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <div className="card">
          <div className="form-grid form-grid-3">
            <Dato titulo="Detalle">{enVista.DetalleRol}</Dato>
            <Dato titulo="Estado">{estadoBadge(enVista.IdEstado)}</Dato>
            <Dato titulo="Usuarios activos con este rol">{String(usuariosDe(enVista.IdRol))}</Dato>
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="section-title">Permisos</h2>
          {esAdmin ? (
            <p>Tiene todos los permisos.</p>
          ) : !asignados.size ? (
            <p className="text-muted">Este rol no tiene permisos asignados.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Módulo</th><th>Permisos</th></tr></thead>
                <tbody>
                  {agruparPermisos(catalogo).map(({ modulo, permisos }) => {
                    const lista = permisos.filter((p) => asignados.has(p.codigo));
                    return lista.length ? <tr key={modulo}><td>{modulo}</td><td>{lista.map((p) => p.descripcion).join(" · ")}</td></tr> : null;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    );
  }

  // ===== Listado de roles: filtro por nombre/detalle y estado, y paginación =====
  const estado = leerEstado(estadoPedido);
  const filtrados = filtrarRoles(todos, { q, estado });
  const pg = paginar({ pagina: sp.pagina, tam: sp.tam }, filtrados.length);
  const lista = filtrados.slice(pg.from, pg.to + 1);
  const hayFiltro = !!q || estado !== undefined;
  const aviso = typeof sp.aviso === "string" ? AVISOS[sp.aviso] : undefined;

  return (
    <section className="space-y-6">
      <div className="page-head">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">Roles y permisos</h1>
          {aviso && <Aviso texto={aviso} />}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/mantenedores" className="btn btn-secondary">Volver</Link>
          <Link href={href({ ...base, crear: "1" })} className="btn btn-primary"><Icon name="plus" size={18} />Crear rol</Link>
        </div>
      </div>

      <div className="space-y-3">
        <FiltrosListado ruta={RUTA} etiqueta="Buscar roles" campo="Nombre o detalle" q={q} estado={estadoPedido} tam={base.tam} />

        <div className="table-wrap table-wrap-sticky">
          <table className="table">
            <thead><tr><th>Rol</th><th>Detalle</th><th className="num">Usuarios activos</th><th className="num">Permisos</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.IdRol}>
                  <td>{r.NombreRol}</td><td>{r.DetalleRol}</td>
                  <td className="num">{usuariosDe(r.IdRol)}</td><td className="num">{cantPermisos(r)}</td>
                  <td>{estadoBadge(r.IdEstado)}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <Link className="link link-sm" href={href({ ...base, ver: String(r.IdRol) })} aria-label={`Ver ${r.NombreRol}`}>Ver</Link>
                      <Link className="link link-sm" href={href({ ...base, editar: String(r.IdRol) })} aria-label={`Editar ${r.NombreRol}`}>Editar</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={6} className="text-muted">{hayFiltro ? "Sin roles que coincidan con la búsqueda." : "Sin roles."}</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={pg} etiqueta="roles" />
      </div>
    </section>
  );
}
