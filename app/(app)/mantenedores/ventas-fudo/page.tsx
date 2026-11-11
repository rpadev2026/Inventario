import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { requerirPaginaAdmin } from "@/lib/auth/session";
import { MSG_SIN_DESDE } from "@/lib/services/ventas-fudo";
import { estadoTrabajoFudo } from "@/lib/services/trabajo-fudo";
import { paginar } from "@/lib/paginacion";
import Paginador from "@/components/app/paginador";
import Sincronizar from "./sincronizar";

type Faltante = { producto: string; nombre: string; motivo: string; cantidad: number };
const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** Ventas de Fudo que descuentan stock: estado de la sincronización (en segundo plano) y los productos vendidos que no pudieron descontar nada. */
export default async function VentasFudoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requerirPaginaAdmin();
  const sp = await searchParams;
  const configurado = !!process.env.FUDO_API_KEY && !!process.env.FUDO_API_SECRET;

  // Cada tabla pagina con sus propios parámetros (fpagina/ftam y vpagina/vtam), que siguen en la URL como los de las subtablas de otros módulos.
  const [trabajos, totalVentas, faltantesTotal, ultima] = await Promise.all([
    estadoTrabajoFudo(),
    db.from("VentasFudo").select("IdVentaFudo", { count: "exact", head: true }),
    db.rpc("faltantes_ventas_fudo", { p_desde: 0, p_limite: 0 }),
    db.from("VentasFudo").select("FechaCierre").order("FechaCierre", { ascending: false }).limit(1),
  ]);
  if (totalVentas.error || faltantesTotal.error || ultima.error) throw new Error("No se pudieron cargar las ventas");
  const pgV = paginar({ pagina: texto(sp.vpagina), tam: texto(sp.vtam) }, totalVentas.count ?? 0);
  const pgF = paginar({ pagina: texto(sp.fpagina), tam: texto(sp.ftam) }, (faltantesTotal.data as { total: number }).total);
  const [ventas, faltantes] = await Promise.all([
    db.from("VentasFudo").select("IdVentaFudo,FechaCierre,FechaProceso").order("FechaCierre", { ascending: false }).order("IdVentaFudo", { ascending: false }).range(pgV.from, pgV.to),
    db.rpc("faltantes_ventas_fudo", { p_desde: pgF.from, p_limite: pgF.tam }),
  ]);
  if (ventas.error || faltantes.error) throw new Error("No se pudieron cargar las ventas");
  const filasFaltantes = (faltantes.data as { filas: Faltante[] }).filas;

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

      <div className="space-y-3">
        <h2 className="section-title">Vendido sin descontar stock</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Producto en Fudo</th><th>Motivo</th><th className="num">Cantidad vendida</th></tr></thead>
            <tbody>
              {filasFaltantes.map((f) => (
                <tr key={f.producto}><td>{f.nombre || `Producto ${f.producto}`}</td><td>{f.motivo === "sin bodega" ? "La receta no tiene bodega" : "Sin receta vinculada"}</td><td className="num">{f.cantidad}</td></tr>
              ))}
              {!filasFaltantes.length && <tr><td colSpan={3} className="text-muted">Todo lo vendido descontó stock.</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={pgF} paramPagina="fpagina" paramTam="ftam" etiqueta="lo vendido sin descontar stock" />
      </div>

      <div className="space-y-3">
        <h2 className="section-title">Últimas ventas descontadas</h2>
        <div className="table-wrap table-wrap-sticky">
          <table className="table">
            <thead><tr><th>Venta (Fudo)</th><th>Cierre</th><th>Procesada</th></tr></thead>
            <tbody>
              {ventas.data.map((v) => <tr key={v.IdVentaFudo}><td>{v.IdVentaFudo}</td><td>{fechaHora(v.FechaCierre)}</td><td>{fechaHora(v.FechaProceso)}</td></tr>)}
              {!ventas.data.length && <tr><td colSpan={3} className="text-muted">Aún no se ha descontado ninguna venta.</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={pgV} paramPagina="vpagina" paramTam="vtam" etiqueta="las últimas ventas descontadas" />
      </div>
    </section>
  );
}
