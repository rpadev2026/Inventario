import Link from "next/link";
import { requerirPaginaPermiso } from "@/lib/auth/session";

/** Índice de reportes. Cada reporte se ve en pantalla con filtros y se puede descargar en CSV (permiso «reportes.ver»). */
export default async function ReportesPage() {
  await requerirPaginaPermiso("reportes.ver");
  return (
    <section className="space-y-4">
      <h1 className="page-title">Reportes</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/reportes/mas-vendidos" className="card card-link">
          <div className="section-title">Productos más vendidos</div>
          <p className="text-sm text-muted">Dashboard con el ranking de los productos más vendidos en Fudo y la evolución de las ventas.</p>
        </Link>
        <Link href="/reportes/stock" className="card card-link">
          <div className="section-title">Stock valorizado</div>
          <p className="text-sm text-muted">Stock actual de cada producto en cada bodega, con su valor (cantidad × costo de compra).</p>
        </Link>
        <Link href="/reportes/ventas-producto" className="card card-link">
          <div className="section-title">Ventas por producto</div>
          <p className="text-sm text-muted">Unidades, ventas y monto de cada producto vendido en Fudo, en un rango de fechas.</p>
        </Link>
        <Link href="/reportes/ventas" className="card card-link">
          <div className="section-title">Ventas por período</div>
          <p className="text-sm text-muted">Ventas diarias, semanales o mensuales de Fudo, por rango de fechas.</p>
        </Link>
      </div>
    </section>
  );
}
