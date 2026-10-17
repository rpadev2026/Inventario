import Link from "next/link";
import { leerEstado } from "@/lib/filtro-estado";
import type { ProductoFila } from "@/lib/productos-filtro";
import { listarPagina } from "@/lib/services/listado";
import Aviso from "@/components/app/aviso";
import Badge from "@/components/app/badge";
import FiltrosListado from "@/components/app/filtros-listado";
import Icon from "@/components/app/icon";
import Paginador from "@/components/app/paginador";
import { AVISOS, href, type Contexto } from "./comun";

/** Listado de productos: filtro por código/nombre y estado, y paginación. */
export async function VistaListado({ ctx }: { ctx: Contexto }) {
  const { sp, base, puedeGestionar, nombreUnidad, nombreFormato } = ctx;
  const { q, estado: estadoPedido } = base;
  const estado = leerEstado(estadoPedido);
  const { filas: lista, pg } = await listarPagina<ProductoFila>("productos", { q, estado, pagina: sp.pagina, tam: sp.tam });
  const hayFiltro = !!q || estado !== undefined;
  const aviso = typeof sp.aviso === "string" ? AVISOS[sp.aviso] : undefined;

  return (
    <section className="space-y-6">
      <div className="page-head">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">Productos</h1>
          {aviso && <Aviso texto={aviso} />}
        </div>
        {puedeGestionar && (
          <Link href={href({ ...base, crear: "1" })} className="btn btn-primary"><Icon name="plus" size={18} />Crear producto</Link>
        )}
      </div>

      <div className="space-y-3">
        <FiltrosListado ruta="/productos" etiqueta="Buscar productos" campo="Código o nombre" q={q} estado={estadoPedido} tam={base.tam} />

        <div className="table-wrap table-wrap-sticky">
          <table className="table">
            <thead>
              <tr><th>Código</th><th>Nombre</th><th>Unidad</th><th>Formato</th><th className="num">Mín.</th><th className="num">Crít.</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.IdProducto}>
                  <td>{p.Codigo ?? "—"}</td><td>{p.Nombre}</td>
                  <td>{nombreUnidad.get(p.UnidadBase) ?? p.UnidadBase}</td><td>{nombreFormato.get(p.Formato) ?? p.Formato}</td>
                  <td className="num">{p.StockMinimo}</td><td className="num">{p.StockCritico}</td>
                  <td><Badge tone={p.IdEstado === 1 ? "ok" : "neutral"}>{p.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge></td>
                  <td>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <Link className="link link-sm" href={href({ ...base, ver: p.Token })} aria-label={`Ver ${p.Nombre}`}>Ver</Link>
                      {puedeGestionar && <Link className="link link-sm" href={href({ ...base, editar: p.Token })} aria-label={`Editar ${p.Nombre}`}>Editar</Link>}
                    </div>
                  </td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={8} className="text-muted">{hayFiltro ? "Sin productos que coincidan con la búsqueda." : "Sin productos."}</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={pg} etiqueta="productos" />
      </div>
    </section>
  );
}
