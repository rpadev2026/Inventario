import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { requerirPaginaAdmin } from "@/lib/auth/session";
import { MSG_SIN_DESDE } from "@/lib/services/ventas-fudo";
import { estadoTrabajoFudo } from "@/lib/services/trabajo-fudo";
import Paginador from "@/components/app/paginador";
import Field from "@/components/app/field";
import { hayFiltros, leerFiltrosVentasFudo, MOTIVOS, paramsFiltros } from "@/lib/ventas-fudo-filtros";
import { faltantesListado, ventasListado } from "@/lib/services/ventas-fudo-listado";
import Sincronizar from "./sincronizar";
import FilaVenta from "./fila-venta";

const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" });
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const RUTA = "/mantenedores/ventas-fudo";

/** Ventas de Fudo que descuentan stock: estado de la sincronización (en segundo plano), filtros, detalle de cada venta y lo vendido sin descontar. */
export default async function VentasFudoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requerirPaginaAdmin();
  const sp = await searchParams;
  const configurado = !!process.env.FUDO_API_KEY && !!process.env.FUDO_API_SECRET;
  const f = leerFiltrosVentasFudo(sp);

  // Cada tabla pagina con sus propios parámetros (fpagina/ftam y vpagina/vtam), que siguen en la URL como los de las subtablas de otros módulos.
  const [trabajos, ventas, faltantes, ultima] = await Promise.all([
    estadoTrabajoFudo(),
    ventasListado(f, { pagina: texto(sp.vpagina), tam: texto(sp.vtam) }),
    faltantesListado(f, { pagina: texto(sp.fpagina), tam: texto(sp.ftam) }),
    db.from("VentasFudo").select("FechaCierre").order("FechaCierre", { ascending: false }).limit(1),
  ]);
  if (ultima.error) throw new Error("No se pudieron cargar las ventas");
  const exportar = (tipo: string) => `/api/fudo/exportar?${paramsFiltros(f, { tipo })}`;
  const tam = { vtam: texto(sp.vtam), ftam: texto(sp.ftam) };

  return (
    <section className="space-y-6">
      <div className="page-head">
        <h1 className="page-title">Ventas de Fudo</h1>
        <Link href="/mantenedores" className="btn btn-secondary">Volver</Link>
      </div>
      <p className="text-muted">
        Cada venta cerrada en Fudo descuenta, de la bodega de la receta vinculada, los ingredientes de esa receta (una sola vez por venta). El stock puede quedar negativo:
        indica que falta registrar una compra o un traspaso. La receta se vincula en su vista «Ver», sección Fudo.
      </p>
      {!configurado && <p role="status" className="alert alert-warn">Fudo no está configurado (faltan FUDO_API_KEY y FUDO_API_SECRET).</p>}
      {configurado && !process.env.FUDO_VENTAS_DESDE && <p role="status" className="alert alert-warn">{MSG_SIN_DESDE}</p>}
      <div className="card space-y-3">
        <p>Última venta descontada: {ultima.data[0] ? fechaHora(ultima.data[0].FechaCierre) : "ninguna aún"}</p>
        <Sincronizar actual={trabajos.actual} ultimo={trabajos.ultimo} />
      </div>

      <form method="get" action={RUTA} role="search" aria-label="Filtrar las ventas de Fudo" className="card space-y-3">
        {tam.vtam && <input type="hidden" name="vtam" value={tam.vtam} />}
        {tam.ftam && <input type="hidden" name="ftam" value={tam.ftam} />}
        <input type="hidden" name="vpagina" value="" />
        <input type="hidden" name="fpagina" value="" />
        <div className="form-grid form-grid-4 items-end">
          <Field label="Venta desde"><input name="desde" type="date" defaultValue={f.desde} className="input" /></Field>
          <Field label="Venta hasta"><input name="hasta" type="date" defaultValue={f.hasta} className="input" /></Field>
          <Field label="Producto"><input name="q" type="search" defaultValue={f.q} className="input" autoComplete="off" /></Field>
          <Field label="Motivo sin descontar">
            <select name="motivo" defaultValue={f.motivo} className="input">
              <option value="">Todos</option>
              {MOTIVOS.map((m) => <option key={m.valor} value={m.valor}>{m.nombre}</option>)}
            </select>
          </Field>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary">Filtrar</button>
          {hayFiltros(f) && <Link href={`${RUTA}?desde=&hasta=&q=&motivo=&vpagina=&fpagina=`} className="btn btn-secondary">Limpiar</Link>}
        </div>
        <p className="text-sm text-muted">
          Las fechas son las de Chile. El filtro de producto y de motivo busca ventas con ese producto vendido o con líneas sin descontar por ese motivo, y se aplica a las dos tablas.
        </p>
      </form>

      <div className="space-y-3">
        <div className="page-head">
          <h2 className="section-title">Vendido sin descontar stock</h2>
          <a href={exportar("faltantes")} className="btn btn-secondary" download>Exportar a Excel (CSV)</a>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Producto en Fudo</th><th>Motivo</th><th className="num">Cantidad vendida</th></tr></thead>
            <tbody>
              {faltantes.listado.filas.map((x) => (
                <tr key={x.producto}><td>{x.nombre || `Producto ${x.producto}`}</td><td>{x.motivo === "sin bodega" ? "La receta no tiene bodega" : "Sin receta vinculada"}</td><td className="num">{x.cantidad}</td></tr>
              ))}
              {!faltantes.listado.filas.length && <tr><td colSpan={3} className="text-muted">{hayFiltros(f) ? "Nada coincide con los filtros." : "Todo lo vendido descontó stock."}</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={faltantes.pg} paramPagina="fpagina" paramTam="ftam" etiqueta="lo vendido sin descontar stock" />
      </div>

      <div className="space-y-3">
        <div className="page-head">
          <h2 className="section-title">Últimas ventas descontadas</h2>
          <a href={exportar("ventas")} className="btn btn-secondary" download>Exportar a Excel (CSV)</a>
        </div>
        <div className="table-wrap table-wrap-sticky">
          <table className="table">
            <thead><tr><th>Venta (Fudo)</th><th>Cierre</th><th>Procesada</th><th className="num">Productos</th><th className="num">Unidades</th><th className="num">Monto</th></tr></thead>
            <tbody>
              {ventas.listado.filas.map((v) => <FilaVenta key={v.id} v={v} />)}
              {!ventas.listado.filas.length && <tr><td colSpan={6} className="text-muted">{hayFiltros(f) ? "Ninguna venta coincide con los filtros." : "Aún no se ha descontado ninguna venta."}</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={ventas.pg} paramPagina="vpagina" paramTam="vtam" etiqueta="las últimas ventas descontadas" />
        <p className="text-sm text-muted">El monto usa el precio de cada línea en Fudo (con IVA). Las ventas procesadas antes de guardar el detalle no muestran sus productos.</p>
      </div>
    </section>
  );
}
