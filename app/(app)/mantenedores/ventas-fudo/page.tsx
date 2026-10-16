import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { requerirPaginaAdmin } from "@/lib/auth/session";
import { MSG_SIN_DESDE } from "@/lib/services/ventas-fudo";
import Sincronizar from "./sincronizar";

type Omitido = { producto: string; nombre: string; cantidad: number; motivo: string };
const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });

/** Ventas de Fudo que descuentan stock: estado de la sincronización y los productos vendidos que no pudieron descontar nada. */
export default async function VentasFudoPage() {
  await requerirPaginaAdmin();
  const configurado = !!process.env.FUDO_API_KEY && !!process.env.FUDO_API_SECRET;
  const { data: ventas, error } = await db.from("VentasFudo").select("IdVentaFudo,FechaCierre,FechaProceso,Omitidos").order("FechaCierre", { ascending: false }).limit(200);
  if (error) throw new Error("No se pudieron cargar las ventas");

  // Lo vendido que no descontó nada (sin receta vinculada o sin bodega), sumado por producto: es lo que falta vincular en Recetas.
  const faltantes = new Map<string, { nombre: string; motivo: string; cantidad: number }>();
  for (const v of ventas) for (const o of v.Omitidos as Omitido[]) {
    const f = faltantes.get(o.producto) ?? { nombre: o.nombre, motivo: o.motivo, cantidad: 0 };
    f.cantidad += Number(o.cantidad);
    faltantes.set(o.producto, f);
  }

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
        <p>Última venta descontada: {ventas[0] ? fechaHora(ventas[0].FechaCierre) : "ninguna aún"}</p>
        <Sincronizar />
      </div>

      <div className="space-y-3">
        <h2 className="section-title">Vendido sin descontar stock</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Producto en Fudo</th><th>Motivo</th><th className="num">Cantidad vendida</th></tr></thead>
            <tbody>
              {[...faltantes.entries()].map(([id, f]) => (
                <tr key={id}><td>{f.nombre || `Producto ${id}`}</td><td>{f.motivo === "sin bodega" ? "La receta no tiene bodega" : "Sin receta vinculada"}</td><td className="num">{f.cantidad}</td></tr>
              ))}
              {!faltantes.size && <tr><td colSpan={3} className="text-muted">Todo lo vendido descontó stock.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="section-title">Últimas ventas descontadas</h2>
        <div className="table-wrap table-wrap-sticky">
          <table className="table">
            <thead><tr><th>Venta (Fudo)</th><th>Cierre</th><th>Procesada</th></tr></thead>
            <tbody>
              {ventas.slice(0, 50).map((v) => <tr key={v.IdVentaFudo}><td>{v.IdVentaFudo}</td><td>{fechaHora(v.FechaCierre)}</td><td>{fechaHora(v.FechaProceso)}</td></tr>)}
              {!ventas.length && <tr><td colSpan={3} className="text-muted">Aún no se ha descontado ninguna venta.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
