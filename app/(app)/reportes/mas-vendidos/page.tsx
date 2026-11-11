import Link from "next/link";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { diasEntre, etiquetaPeriodo, leerRango, paramsRango, type Agrupacion } from "@/lib/reporte-ventas";
import { ventasPeriodo, ventasProductoCompleto } from "@/lib/services/reportes";
import Field from "@/components/app/field";
import { fmtCantidad, fmtPesos } from "../comun";
import { AtajosRango, CamposRango } from "../filtros-fechas";
import { Columnas, Ranking } from "../graficos";

type Params = Record<string, string | string[] | undefined>;
const TOP = 10;

/** Dashboard de los productos más vendidos de Fudo en un rango de fechas: lo principal, el ranking y la evolución de las ventas. */
export default async function MasVendidosPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requerirPaginaPermiso("reportes.ver");
  const sp = await searchParams;
  const rango = leerRango(sp);
  const orden = sp.orden === "monto" ? "monto" : "unidades";
  // Rangos largos se agrupan por semana o mes para que las columnas sigan siendo legibles.
  const dias = diasEntre(rango.desde, rango.hasta) + 1;
  const agrupar: Agrupacion = dias <= 62 ? "dia" : dias <= 400 ? "semana" : "mes";
  const [prod, periodo] = await Promise.all([ventasProductoCompleto(rango, ""), ventasPeriodo(rango, agrupar)]);

  const valor = (f: { unidades: number; monto: number | null }) => (orden === "monto" ? Number(f.monto ?? 0) : Number(f.unidades));
  const top = [...prod.filas].filter((f) => valor(f) > 0).sort((a, b) => valor(b) - valor(a)).slice(0, TOP);
  const filasRanking = top.map((f) => ({
    clave: f.idProductoFudo, nombre: f.producto, valor: valor(f),
    texto: orden === "monto" ? fmtPesos(Number(f.monto ?? 0)) : fmtCantidad(Number(f.unidades)),
    detalle: `${f.producto}: ${fmtCantidad(Number(f.unidades))} unidades, ${f.monto === null ? "sin precio" : fmtPesos(Number(f.monto))}, en ${f.ventas} ventas`,
  }));
  const unidadGrafico = orden === "monto" ? "monto" : "unidades";
  const puntos = periodo.filas.map((p) => ({
    etiqueta: etiquetaPeriodo(p.periodo, agrupar), valor: orden === "monto" ? Number(p.monto) : Number(p.unidades),
    texto: `${fmtCantidad(Number(p.unidades))} unidades, ${fmtPesos(Number(p.monto))}, ${p.ventas} ventas`,
  }));
  const maxPunto = Math.max(...puntos.map((p) => p.valor), 0);
  const csv = `/api/reportes/ventas-producto?${paramsRango(rango)}`;

  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">Productos más vendidos</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/reportes" className="btn btn-secondary">Volver</Link>
          <a href={csv} className="btn btn-primary" download>Descargar CSV</a>
        </div>
      </div>

      <AtajosRango ruta="/reportes/mas-vendidos" extra={{ orden }} />
      <form method="get" action="/reportes/mas-vendidos" role="search" aria-label="Filtrar el dashboard de ventas" className="form-grid form-grid-4 items-end">
        <CamposRango rango={rango} />
        <Field label="Ordenar por">
          <select name="orden" defaultValue={orden} className="input">
            <option value="unidades">Unidades vendidas</option>
            <option value="monto">Monto vendido</option>
          </select>
        </Field>
        <div className="form-actions"><button className="btn btn-primary">Ver</button></div>
      </form>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card"><div className="kpi-value">{fmtPesos(Number(prod.monto))}</div><div className="text-sm text-muted">Monto vendido</div></div>
        <div className="card"><div className="kpi-value">{fmtCantidad(Number(prod.unidades))}</div><div className="text-sm text-muted">Unidades vendidas</div></div>
        <div className="card"><div className="kpi-value">{prod.total}</div><div className="text-sm text-muted">Productos distintos</div></div>
        <div className="card"><div className="kpi-value">{prod.ventas}</div><div className="text-sm text-muted">Ventas cerradas</div></div>
      </div>
      {prod.ventas === 0 && (
        <p role="status" className="alert alert-warn">
          No hay ventas guardadas en este rango. Las ventas se cargan al sincronizar con Fudo (Mantenedores → Ventas de Fudo).
        </p>
      )}
      {prod.lineasSinMonto > 0 && (
        <p role="status" className="alert alert-warn">
          {prod.lineasSinMonto} {prod.lineasSinMonto === 1 ? "línea no trae" : "líneas no traen"} precio desde Fudo: cuentan en las unidades, pero no en el monto.
        </p>
      )}

      {top.length > 0 && (
        <div className="card space-y-3">
          <h2 className="section-title">Los {top.length} más vendidos por {orden === "monto" ? "monto" : "unidades"}</h2>
          <Ranking filas={filasRanking} etiqueta={`Productos más vendidos por ${unidadGrafico}`} />
          <details>
            <summary className="link">Ver como tabla</summary>
            <div className="table-wrap mt-3">
              <table className="table">
                <thead><tr><th>#</th><th>Producto (Fudo)</th><th>Receta vinculada</th><th className="num">Unidades</th><th className="num">Ventas</th><th className="num">Monto</th></tr></thead>
                <tbody>
                  {top.map((f, i) => (
                    <tr key={f.idProductoFudo}>
                      <td>{i + 1}</td><td>{f.producto}</td><td>{f.receta ?? <span className="text-muted">Sin receta</span>}</td>
                      <td className="num">{fmtCantidad(Number(f.unidades))}</td><td className="num">{f.ventas}</td>
                      <td className="num">{f.monto === null ? "—" : fmtPesos(Number(f.monto))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <p className="text-sm text-muted">
            El resto de los productos está en <Link className="link" href={`/reportes/ventas-producto?${paramsRango(rango)}`}>Ventas por producto</Link>.
          </p>
        </div>
      )}

      {puntos.length > 0 && prod.ventas > 0 && (
        <div className="card space-y-3">
          <h2 className="section-title">{orden === "monto" ? "Monto vendido" : "Unidades vendidas"} por {agrupar === "dia" ? "día" : agrupar === "semana" ? "semana" : "mes"}</h2>
          <Columnas puntos={puntos} etiqueta={`Ventas por ${agrupar}`} maximo={`Máximo: ${orden === "monto" ? fmtPesos(maxPunto) : fmtCantidad(maxPunto)}`} />
          <p className="text-sm text-muted">Pase el cursor o enfoque una columna para ver su detalle. Montos con IVA según los precios de las líneas en Fudo.</p>
        </div>
      )}
    </section>
  );
}
