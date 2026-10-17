import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { etiquetaProducto } from "@/lib/producto-etiqueta";
import { leerFiltrosStock, paramsStock } from "@/lib/reporte-stock";
import { stockPagina } from "@/lib/services/reportes";
import Badge from "@/components/app/badge";
import Field from "@/components/app/field";
import Paginador from "@/components/app/paginador";
import { fmtCantidad, fmtCosto, fmtPesos } from "../comun";

type Params = Record<string, string | string[] | undefined>;

/** Stock actual de cada producto en cada bodega (el mismo producto puede estar en varias), valorizado a su último costo de compra. */
export default async function ReporteStockPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requerirPaginaPermiso("reportes.ver");
  const sp = await searchParams;
  const f = leerFiltrosStock(sp);
  const tam = typeof sp.tam === "string" ? sp.tam : undefined;
  const [{ reporte, pg }, { data: bodegas }] = await Promise.all([
    stockPagina(f, { pagina: sp.pagina, tam: sp.tam }),
    db.from("Bodegas").select("IdBodega,NombreBodega").order("NombreBodega"),
  ]);
  const hayFiltro = !!f.bodega || !!f.q || f.soloConStock;
  const csv = `/api/reportes/stock${paramsStock(f) ? `?${paramsStock(f)}` : ""}`;

  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">Stock valorizado</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/reportes" className="btn btn-secondary">Volver</Link>
          <a href={csv} className="btn btn-primary" download>Descargar CSV</a>
        </div>
      </div>

      <form method="get" action="/reportes/stock" role="search" aria-label="Filtrar el reporte de stock" className="form-grid form-grid-4 items-end">
        {tam && <input type="hidden" name="tam" value={tam} />}
        <input type="hidden" name="pagina" value="" />
        <Field label="Bodega">
          <select name="bodega" defaultValue={f.bodega ? String(f.bodega) : ""} className="input">
            <option value="">Todas</option>
            {(bodegas ?? []).map((b) => <option key={b.IdBodega} value={b.IdBodega}>{b.NombreBodega}</option>)}
          </select>
        </Field>
        <Field label="Producto (código o nombre)" className="fld-2">
          <input name="q" type="search" defaultValue={f.q} className="input" autoComplete="off" />
        </Field>
        <label className="flex items-center gap-2">
          <input type="hidden" name="con_stock" value="" />
          <input type="checkbox" name="con_stock" value="1" defaultChecked={f.soloConStock} />
          <span>Solo con stock</span>
        </label>
        <div className="form-actions">
          <button className="btn btn-primary">Buscar</button>
          {hayFiltro && <Link href="/reportes/stock?bodega=&q=&con_stock=&pagina=" className="btn btn-secondary">Limpiar</Link>}
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card"><div className="kpi-value">{fmtPesos(Number(reporte.valorTotal))}</div><div className="text-sm text-muted">Valor total del stock</div></div>
        <div className="card"><div className="kpi-value">{reporte.total}</div><div className="text-sm text-muted">Filas (producto en bodega)</div></div>
        <div className={`card ${reporte.sinCosto > 0 ? "card-alert" : ""}`}><div className="kpi-value">{reporte.sinCosto}</div><div className="text-sm text-muted">Con stock y sin costo</div></div>
      </div>
      {reporte.sinCosto > 0 && (
        <p role="status" className="alert alert-warn">
          El valor total es parcial: {reporte.sinCosto} {reporte.sinCosto === 1 ? "producto con stock no tiene" : "productos con stock no tienen"} costo
          (todavía no se compran en una factura), así que no suman al total.
        </p>
      )}

      {reporte.porBodega.length > 1 && (
        <div className="table-wrap">
          <table className="table">
            <caption className="section-title">Por bodega</caption>
            <thead><tr><th>Bodega</th><th className="num">Filas</th><th className="num">Valor</th></tr></thead>
            <tbody>
              {reporte.porBodega.map((b) => (
                <tr key={b.idBodega}><td>{b.bodega}</td><td className="num">{b.filas}</td><td className="num">{fmtPesos(Number(b.valor))}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="table-wrap table-wrap-sticky">
        <table className="table">
          <thead><tr><th>Producto</th><th>Bodega</th><th className="num">Cantidad</th><th className="num">Costo unitario (con IVA)</th><th className="num">Valor</th></tr></thead>
          <tbody>
            {reporte.filas.map((r) => (
              <tr key={`${r.idBodega}-${r.idProducto}`}>
                <td>{etiquetaProducto(r.codigo, r.producto)}</td>
                <td>{r.bodega}</td>
                <td className="num">{fmtCantidad(Number(r.cantidad))} <span className="text-muted">{r.unidad}</span></td>
                <td className="num">{r.costo === null ? <Badge tone="warn">Sin costo</Badge> : fmtCosto(Number(r.costo))}</td>
                <td className="num">{r.valor === null ? "—" : fmtPesos(Number(r.valor))}</td>
              </tr>
            ))}
            {reporte.filas.length === 0 && <tr><td colSpan={5} className="text-muted">{hayFiltro ? "Ningún resultado con esos filtros." : "Todavía no hay stock en ninguna bodega."}</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginador pg={pg} etiqueta="stock valorizado" />
    </section>
  );
}
