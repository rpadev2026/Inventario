import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { requerirPaginaAdmin } from "@/lib/auth/session";
import { paginar } from "@/lib/paginacion";
import { leerEstado } from "@/lib/filtro-estado";
import { filtrarUsuarios, type UsuarioFila } from "@/lib/usuarios-filtro";
import Aviso from "@/components/app/aviso";
import Badge from "@/components/app/badge";
import FiltrosListado from "@/components/app/filtros-listado";
import Icon from "@/components/app/icon";
import Paginador from "@/components/app/paginador";
import { asignarRol, quitarRol } from "./actions";
import FormNuevoUsuario from "./form-nuevo";
import FormEditarUsuario from "./form-editar";
import FormClaveUsuario from "./form-clave";

type Params = Record<string, string | string[] | undefined>;
const entero = (v: unknown) => (typeof v === "string" && /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : undefined);
const texto = (v: string | string[] | undefined) => (typeof v === "string" && v !== "" ? v : undefined);
const AVISOS: Record<string, string> = {
  creado: "Usuario creado correctamente. Deberá cambiar su clave al ingresar.",
  editado: "Cambios guardados correctamente",
};
const estadoBadge = (e: number) => <Badge tone={e === 1 ? "ok" : "neutral"}>{e === 1 ? "Vigente" : "No vigente"}</Badge>;

/** URL de /usuarios con solo los parámetros indicados (los undefined se omiten). */
function href(q: Record<string, string | undefined>) {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined) as [string, string][]).toString();
  return s ? `/usuarios?${s}` : "/usuarios";
}
const Dato = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div><div className="label-block">{titulo}</div><div>{children || "—"}</div></div>
);

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sesion = await requerirPaginaAdmin();
  const sp = await searchParams;
  const crear = sp.crear === "1";
  const idEditar = crear ? undefined : entero(sp.editar);
  const idVer = crear || idEditar ? undefined : entero(sp.ver);

  // Parámetros del listado (página, tamaño y filtros) que se conservan al ir a una vista y volver.
  const q = texto(sp.q);
  const estadoPedido = texto(sp.estado);
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q, estado: estadoPedido };
  const volverListado = href(base);

  const { data: rolesVigentes } = await db.from("Roles").select("IdRol,NombreRol").eq("IdEstado", 1).order("NombreRol");
  const roles = rolesVigentes ?? [];

  // ===== Crear: solo el formulario, con Volver =====
  if (crear) {
    return (
      <section className="space-y-4">
        <div className="page-head">
          <h1 className="page-title">Crear usuario</h1>
          <Link href={volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <div className="card">
          <FormNuevoUsuario roles={roles} despuesDeGuardar={href({ tam: base.tam, aviso: "creado" })} />
        </div>
      </section>
    );
  }

  const idPanel = idEditar ?? idVer;
  const { data: sel } = idPanel
    ? await db.from("Usuarios").select("IdUsuario,Rut,Nombres,Apellidos,Correo,IdEstado,FechaRegistroCreacion").eq("IdUsuario", idPanel).maybeSingle()
    : { data: null };

  // Roles vigentes de un usuario (para Ver y Editar).
  const rolesDe = async (id: number) => {
    const { data } = await db.from("UsuariosRoles").select("IdRol").eq("IdUsuario", id).eq("IdEstado", 1);
    const asignados = new Set((data ?? []).map((r) => r.IdRol));
    return { asignados: roles.filter((r) => asignados.has(r.IdRol)), disponibles: roles.filter((r) => !asignados.has(r.IdRol)) };
  };

  // ===== Editar: datos del usuario y sus roles, con Volver =====
  if (idEditar && sel) {
    const { asignados, disponibles } = await rolesDe(sel.IdUsuario);
    const esPropio = sel.IdUsuario === sesion.uid;
    return (
      <section className="space-y-6">
        <div className="page-head">
          <h1 className="page-title">Editar usuario</h1>
          <Link href={volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <div className="card">
          <FormEditarUsuario key={sel.IdUsuario} u={sel} esPropio={esPropio} despuesDeGuardar={href({ ...base, aviso: "editado" })} />
        </div>

        <div className="space-y-3">
          <h2 className="section-title">Clave</h2>
          <div className="card"><FormClaveUsuario key={sel.IdUsuario} id={sel.IdUsuario} /></div>
        </div>

        <div className="space-y-3">
          <h2 className="section-title">Roles</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Rol</th><th>Acciones</th></tr></thead>
              <tbody>
                {asignados.map((r) => {
                  const noQuitar = esPropio && r.NombreRol === "Administrador"; // evita dejar el sistema sin gestión de usuarios
                  return (
                    <tr key={r.IdRol}>
                      <td>{r.NombreRol}</td>
                      <td>
                        <form action={quitarRol}>
                          <input type="hidden" name="id" value={sel.IdUsuario} />
                          <input type="hidden" name="idRol" value={r.IdRol} />
                          <button className="link link-sm" disabled={noQuitar} title={noQuitar ? "No puede quitarse a sí mismo el rol de Administrador" : undefined}
                            aria-label={`Quitar rol ${r.NombreRol}`}>Quitar</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
                {!asignados.length && <tr><td colSpan={2} className="text-muted">Este usuario no tiene roles.</td></tr>}
              </tbody>
            </table>
          </div>
          {disponibles.length > 0 && (
            <form action={asignarRol} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={sel.IdUsuario} />
              <label className="field">
                <span className="field-label">Rol a agregar</span>
                <select name="idRol" className="input">{disponibles.map((r) => <option key={r.IdRol} value={r.IdRol}>{r.NombreRol}</option>)}</select>
              </label>
              <button className="btn btn-primary"><Icon name="plus" size={18} />Agregar rol</button>
            </form>
          )}
        </div>
      </section>
    );
  }

  // ===== Ver: datos del usuario y sus roles (solo lectura) =====
  if (idVer && sel) {
    const { asignados } = await rolesDe(sel.IdUsuario);
    return (
      <section className="space-y-6">
        <div className="page-head">
          <h1 className="page-title">{sel.Nombres} {sel.Apellidos}</h1>
          <Link href={volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <div className="card">
          <div className="form-grid form-grid-3">
            <Dato titulo="RUT">{sel.Rut}</Dato>
            <Dato titulo="Correo">{sel.Correo}</Dato>
            <Dato titulo="Estado">{estadoBadge(sel.IdEstado)}</Dato>
            <Dato titulo="Nombres">{sel.Nombres}</Dato>
            <Dato titulo="Apellidos">{sel.Apellidos}</Dato>
            <Dato titulo="Registrado el">{new Date(sel.FechaRegistroCreacion).toLocaleDateString("es-CL")}</Dato>
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="section-title">Roles</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Rol</th></tr></thead>
              <tbody>
                {asignados.map((r) => <tr key={r.IdRol}><td>{r.NombreRol}</td></tr>)}
                {!asignados.length && <tr><td className="text-muted">Este usuario no tiene roles.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  // ===== Listado de usuarios: filtro por RUT/nombre/correo y estado, y paginación =====
  const [{ data: todos }, { data: ur }] = await Promise.all([
    db.from("Usuarios").select("IdUsuario,Rut,Nombres,Apellidos,Correo,IdEstado").returns<UsuarioFila[]>(),
    db.from("UsuariosRoles").select("IdUsuario,IdRol").eq("IdEstado", 1),
  ]);
  const nombreRol = new Map(roles.map((r) => [r.IdRol, r.NombreRol]));
  const estado = leerEstado(estadoPedido);
  const filtrados = filtrarUsuarios(todos ?? [], { q, estado });
  const pg = paginar({ pagina: sp.pagina, tam: sp.tam }, filtrados.length);
  const lista = filtrados.slice(pg.from, pg.to + 1);
  const hayFiltro = !!q || estado !== undefined;
  const aviso = typeof sp.aviso === "string" ? AVISOS[sp.aviso] : undefined;

  return (
    <section className="space-y-6">
      <div className="page-head">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">Usuarios</h1>
          {aviso && <Aviso texto={aviso} />}
        </div>
        <Link href={href({ ...base, crear: "1" })} className="btn btn-primary"><Icon name="plus" size={18} />Crear usuario</Link>
      </div>

      <div className="space-y-3">
        <FiltrosListado ruta="/usuarios" etiqueta="Buscar usuarios" campo="RUT, nombre o correo" q={q} estado={estadoPedido} tam={base.tam} />

        <div className="table-wrap table-wrap-sticky">
          <table className="table">
            <thead><tr><th>RUT</th><th>Nombre</th><th>Correo</th><th>Roles</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {lista.map((u) => {
                const mios = (ur ?? []).filter((x) => x.IdUsuario === u.IdUsuario).map((x) => nombreRol.get(x.IdRol)).filter(Boolean);
                return (
                  <tr key={u.IdUsuario}>
                    <td>{u.Rut}</td>
                    <td>{u.Nombres} {u.Apellidos}</td>
                    <td>{u.Correo}</td>
                    <td>{mios.length ? mios.join(", ") : <span className="text-muted">Sin roles</span>}</td>
                    <td>{estadoBadge(u.IdEstado)}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <Link className="link link-sm" href={href({ ...base, ver: String(u.IdUsuario) })} aria-label={`Ver ${u.Nombres} ${u.Apellidos}`}>Ver</Link>
                        <Link className="link link-sm" href={href({ ...base, editar: String(u.IdUsuario) })} aria-label={`Editar ${u.Nombres} ${u.Apellidos}`}>Editar</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!lista.length && <tr><td colSpan={6} className="text-muted">{hayFiltro ? "Sin usuarios que coincidan con la búsqueda." : "Sin usuarios."}</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={pg} etiqueta="usuarios" />
      </div>
    </section>
  );
}
