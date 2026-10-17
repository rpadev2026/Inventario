import Link from "next/link";
import { leerEstado } from "@/lib/filtro-estado";
import type { RecetaFila } from "@/lib/recetas-filtro";
import { costoDeReceta } from "@/lib/receta-calculo";
import { listarPagina } from "@/lib/services/listado";
import Aviso from "@/components/app/aviso";
import Badge from "@/components/app/badge";
import FiltrosListado from "@/components/app/filtros-listado";
import Icon from "@/components/app/icon";
import Paginador from "@/components/app/paginador";
import { AVISOS, calcularVarias, clp, href, num, type Contexto } from "./comun";

/** Listado: filtro por código/nombre y estado, y paginación; cada fila con su costo por porción. */
export async function VistaListado({ ctx }: { ctx: Contexto }) {
  const { sp, base, puedeGestionar } = ctx;
  const { q, estado: estadoPedido } = base;
  const estado = leerEstado(estadoPedido);
  const { filas: lista, pg } = await listarPagina<RecetaFila>("recetas", { q, estado, pagina: sp.pagina, tam: sp.tam });
  const costos = await calcularVarias(lista.map((r) => r.IdReceta));
  const hayFiltro = !!q || estado !== undefined;
  const aviso = typeof sp.aviso === "string" ? AVISOS[sp.aviso] : undefined;

  return (
    <section className="space-y-6">
      <div className="page-head">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">Recetas</h1>
          {aviso && <Aviso texto={aviso} />}
        </div>
        {puedeGestionar && (
          <Link href={href({ ...base, crear: "1" })} className="btn btn-primary"><Icon name="plus" size={18} />Crear receta</Link>
        )}
      </div>

      <div className="space-y-3">
        <FiltrosListado ruta="/recetas" etiqueta="Buscar recetas" campo="Código o nombre" q={q} estado={estadoPedido} tam={base.tam} />

        <div className="table-wrap table-wrap-sticky">
          <table className="table">
            <thead><tr><th>Código</th><th>Nombre</th><th className="num">Porciones</th><th className="num">Costo por porción</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {lista.map((r) => {
                const c = costoDeReceta(costos, r.IdReceta);
                return (
                  <tr key={r.IdReceta}>
                    <td>{r.CodigoReceta ?? "—"}</td><td>{r.Nombre}</td>
                    <td className="num">{num.format(Number(r.RendimientoPorciones))}</td>
                    <td className="num">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {c ? clp(c.porcion) : "—"}
                        {c?.incompleto && <Badge tone="warn">Incompleto</Badge>}
                      </div>
                    </td>
                    <td><Badge tone={r.IdEstado === 1 ? "ok" : "neutral"}>{r.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge></td>
                    <td>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <Link className="link link-sm" href={href({ ...base, ver: r.Token })} aria-label={`Ver ${r.Nombre}`}>Ver</Link>
                        {puedeGestionar && <Link className="link link-sm" href={href({ ...base, editar: r.Token })} aria-label={`Editar ${r.Nombre}`}>Editar</Link>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!lista.length && <tr><td colSpan={6} className="text-muted">{hayFiltro ? "Sin recetas que coincidan con la búsqueda." : "Sin recetas."}</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={pg} etiqueta="recetas" />
      </div>
    </section>
  );
}
