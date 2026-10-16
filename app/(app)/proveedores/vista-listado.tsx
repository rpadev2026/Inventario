import Link from "next/link";
import { leerEstado } from "@/lib/filtro-estado";
import type { ProveedorFila } from "@/lib/proveedores-filtro";
import { listarPagina } from "@/lib/services/listado";
import Aviso from "@/components/app/aviso";
import FiltrosListado from "@/components/app/filtros-listado";
import Icon from "@/components/app/icon";
import Paginador from "@/components/app/paginador";
import { AVISOS, estadoBadge, href, type Contexto } from "./comun";

/** Listado de proveedores: filtro por RUT/razón social/giro y estado, y paginación. */
export async function VistaListado({ ctx }: { ctx: Contexto }) {
  const { sp, base, puedeGestionar } = ctx;
  const { q, estado: estadoPedido } = base;
  const estado = leerEstado(estadoPedido);
  const { filas: lista, pg } = await listarPagina<ProveedorFila>("proveedores", { q, estado, pagina: sp.pagina, tam: sp.tam });
  const hayFiltro = !!q || estado !== undefined;
  const aviso = typeof sp.aviso === "string" ? AVISOS[sp.aviso] : undefined;

  return (
    <section className="space-y-6">
      <div className="page-head">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">Proveedores</h1>
          {aviso && <Aviso texto={aviso} />}
        </div>
        {puedeGestionar && (
          <Link href={href({ ...base, crear: "1" })} className="btn btn-primary"><Icon name="plus" size={18} />Crear proveedor</Link>
        )}
      </div>

      <div className="space-y-3">
        <FiltrosListado ruta="/proveedores" etiqueta="Buscar proveedores" campo="RUT, razón social o giro" q={q} estado={estadoPedido} tam={base.tam} />

        <div className="table-wrap table-wrap-sticky">
          <table className="table">
            <thead><tr><th>RUT</th><th>Razón social</th><th>Giro</th><th>Teléfono</th><th>Correo</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.IdProveedor}>
                  <td>{p.Rut}</td><td>{p.RazonSocial}</td><td>{p.Giro}</td><td>{p.Telefono}</td><td>{p.Correo}</td>
                  <td>{estadoBadge(p.IdEstado)}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <Link className="link link-sm" href={href({ ...base, ver: String(p.IdProveedor) })} aria-label={`Ver ${p.RazonSocial}`}>Ver</Link>
                      {puedeGestionar && <Link className="link link-sm" href={href({ ...base, editar: String(p.IdProveedor) })} aria-label={`Editar ${p.RazonSocial}`}>Editar</Link>}
                    </div>
                  </td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={7} className="text-muted">{hayFiltro ? "Sin proveedores que coincidan con la búsqueda." : "Sin proveedores."}</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={pg} etiqueta="proveedores" />
      </div>
    </section>
  );
}
