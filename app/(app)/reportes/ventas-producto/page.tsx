import Link from "next/link";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { leerRango, paramsRango } from "@/lib/reporte-ventas";
import { ventasProductoPagina } from "@/lib/services/reportes";
import Badge from "@/components/app/badge";
import Field from "@/components/app/field";
import Paginador from "@/components/app/paginador";
import { fmtCantidad, fmtPesos } from "../comun";
import { AtajosRango, CamposRango } from "../filtros-fechas";

type Params = Record<string, string | string[] | undefined>;

/** Resumen de ventas de Fudo por producto (unidades, monto y ventas) dentro de un rango de fechas (de Chile). */
export default async function ReporteVentasProductoPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requerirPaginaPermiso("reportes.ver");
  const sp = await searchParams;
  const rango = leerRango(sp);
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const tam = typeof sp.tam === "string" ? sp.tam : undefined;
  const { reporte: r, pg } = await ventasProductoPagina(rango, q, { pagina: sp.pagina, tam: sp.tam });
  const csv = `/api/reportes/ventas-producto?${paramsRango(rango, { q })}`;

  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">Ventas por producto</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/reportes" className="btn btn-secondary">Volver</Link>
          <a href={csv} className="btn btn-primary" download>Descargar CSV</a>
        </div>
      </div>

      <AtajosRango ruta="/reportes/ventas-producto" extra={{ q, tam }} />
      <form method="get" action="/reportes/ventas-producto" role="search" aria-label="Filtrar las ventas por producto" className="form-grid form-grid-4 items-end">
        {tam && <input type="hidden" name="tam" value={tam} />}
        <input type="hidden" name="pagina" value="" />
        <CamposRango rango={rango} />
        <Field label="Producto" className="fld-2"><input name="q" type="search" defaultValue={q} className="input" autoComplete="off" /></Field>
        <div className="form-actions"><button className="btn btn-primary">Ver</button></div>
      </form>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card"><div className="kpi-value">{fmtPesos(Number(r.monto))}</div><div className="text-sm text-muted">Monto vendido</div></div>
        <div className="card"><div className="kpi-value">{fmtCantidad(Number(r.unidades))}</div><div className="text-sm text-muted">Unidades vendidas</div></div>
        <div className="card"><div className="kpi-value">{r.total}</div><div className="text-sm text-muted">Productos distintos</div></div>
        <div className="card"><div className="kpi-value">{r.ventas}</div><div className="text-sm text-muted">Ventas cerradas</div></div>
      </div>
      {r.lineasSinMonto > 0 && (
        <p role="status" className="alert alert-warn">
          {r.lineasSinMonto} {r.lineasSinMonto === 1 ? "línea vendida no trae" : "líneas vendidas no traen"} precio desde Fudo: cuentan en las unidades, pero no suman al monto.
        </p>
      )}
      {r.ventas === 0 && (
        <p role="status" className="alert alert-warn">
          No hay ventas guardadas en este rango. Las ventas se cargan al sincronizar con Fudo (Mantenedores → Ventas de Fudo); solo se guardan desde que esa carga está activa.
        </p>
      )}

      <div className="table-wrap table-wrap-sticky">
        <table className="table">
          <thead><tr><th>Producto (Fudo)</th><th>Receta vinculada</th><th className="num">Unidades</th><th className="num">Ventas</th><th className="num">Monto</th></tr></thead>
          <tbody>
            {r.filas.map((f) => (
              <tr key={f.idProductoFudo}>
                <td>{f.producto}</td>
                <td>{f.receta ?? <span className="text-muted">Sin receta</span>}</td>
                <td className="num">{fmtCantidad(Number(f.unidades))}</td>
                <td className="num">{f.ventas}</td>
                <td className="num">{f.monto === null ? <Badge tone="warn">Sin precio</Badge> : fmtPesos(Number(f.monto))}{f.monto !== null && f.sinMonto > 0 && <span className="text-muted"> (parcial)</span>}</td>
              </tr>
            ))}
            {r.filas.length === 0 && <tr><td colSpan={5} className="text-muted">{q ? "Ningún producto con ese nombre en el rango." : "Sin ventas en el rango."}</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginador pg={pg} etiqueta="ventas por producto" />
      <p className="text-sm text-muted">Montos con IVA según los precios de las líneas en Fudo; los descuentos o propinas de la venta completa no se reparten entre líneas.</p>
    </section>
  );
}
