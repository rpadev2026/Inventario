import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { leerEstado } from "@/lib/filtro-estado";
import type { UsuarioFila } from "@/lib/usuarios-filtro";
import { listarPagina } from "@/lib/services/listado";
import Aviso from "@/components/app/aviso";
import FiltrosListado from "@/components/app/filtros-listado";
import Icon from "@/components/app/icon";
import Paginador from "@/components/app/paginador";
import { AVISOS, estadoBadge, href, type Contexto } from "./comun";

/** Listado de usuarios: filtro por RUT/nombre/correo y estado, y paginación; cada fila con sus roles. */
export async function VistaListado({ ctx }: { ctx: Contexto }) {
  const { sp, base, roles } = ctx;
  const { q, estado: estadoPedido } = base;
  const estado = leerEstado(estadoPedido);
  const { filas: lista, pg } = await listarPagina<UsuarioFila>("usuarios", { q, estado, pagina: sp.pagina, tam: sp.tam });
  // Solo los roles de los usuarios de la página.
  const { data: ur, error: errR } = lista.length
    ? await db.from("UsuariosRoles").select("IdUsuario,IdRol").eq("IdEstado", 1).in("IdUsuario", lista.map((u) => u.IdUsuario))
    : { data: [], error: null };
  if (errR) throw new Error("No se pudo cargar los roles de los usuarios");
  const nombreRol = new Map(roles.map((r) => [r.IdRol, r.NombreRol]));
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
                        <Link className="link link-sm" href={href({ ...base, ver: u.Token })} aria-label={`Ver ${u.Nombres} ${u.Apellidos}`}>Ver</Link>
                        <Link className="link link-sm" href={href({ ...base, editar: u.Token })} aria-label={`Editar ${u.Nombres} ${u.Apellidos}`}>Editar</Link>
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
