import Link from "next/link";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { etiquetaPeriodo, leerAgrupacion, leerRango, paramsRango } from "@/lib/reporte-ventas";
import { ventasPeriodo } from "@/lib/services/reportes";
import Field from "@/components/app/field";
import { fmtCantidad, fmtPesos } from "../comun";
import { AtajosRango, CamposRango } from "../filtros-fechas";

type Params = Record<string, string | string[] | undefined>;
const NOMBRE = { dia: "Día", semana: "Semana", mes: "Mes" } as const;

/** Ventas de Fudo por día, semana o mes dentro de un rango de fechas (de Chile). */
export default async function ReporteVentasPeriodoPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requerirPaginaPermiso("reportes.ver");
  const sp = await searchParams;
  const rango = leerRango(sp);
  const agrupar = leerAgrupacion(sp);
  const r = await ventasPeriodo(rango, agrupar);
  const csv = `/api/reportes/ventas?${paramsRango(rango, { agrupar })}`;

  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">Ventas por período</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/reportes" className="btn btn-secondary">Volver</Link>
          <a href={csv} className="btn btn-primary" download>Descargar CSV</a>
        </div>
      </div>

      <AtajosRango ruta="/reportes/ventas" extra={{ agrupar }} />
      <form method="get" action="/reportes/ventas" role="search" aria-label="Filtrar las ventas por período" className="form-grid form-grid-4 items-end">
        <CamposRango rango={rango} />
        <Field label="Agrupar por">
          <select name="agrupar" defaultValue={agrupar} className="input">
            <option value="dia">Día</option><option value="semana">Semana (lunes a domingo)</option><option value="mes">Mes</option>
          </select>
        </Field>
        <div className="form-actions"><button className="btn btn-primary">Ver</button></div>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card"><div className="kpi-value">{fmtPesos(Number(r.monto))}</div><div className="text-sm text-muted">Monto vendido</div></div>
        <div className="card"><div className="kpi-value">{r.ventas}</div><div className="text-sm text-muted">Ventas cerradas</div></div>
        <div className="card"><div className="kpi-value">{fmtCantidad(Number(r.unidades))}</div><div className="text-sm text-muted">Unidades vendidas</div></div>
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
      {agrupar !== "dia" && <p className="text-sm text-muted">El primer y el último período pueden ser parciales: solo cuentan los días dentro del rango.</p>}

      <div className="table-wrap table-wrap-sticky">
        <table className="table">
          <thead><tr><th>{NOMBRE[agrupar]}</th><th className="num">Ventas</th><th className="num">Unidades</th><th className="num">Monto</th><th className="num">Promedio por venta</th></tr></thead>
          <tbody>
            {r.filas.map((f) => (
              <tr key={f.periodo}>
                <td>{etiquetaPeriodo(f.periodo, agrupar)}</td>
                <td className="num">{f.ventas}</td>
                <td className="num">{fmtCantidad(Number(f.unidades))}</td>
                <td className="num">{fmtPesos(Number(f.monto))}</td>
                <td className="num">{f.ventas > 0 ? fmtPesos(Number(f.monto) / f.ventas) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">Montos con IVA según los precios de las líneas en Fudo; los descuentos o propinas de la venta completa no se reparten entre líneas.</p>
    </section>
  );
}
