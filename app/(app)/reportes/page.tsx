import Link from "next/link";
import { requerirPaginaPermiso } from "@/lib/auth/session";

/** Índice de reportes. Cada reporte se ve en pantalla con filtros y se puede descargar en CSV (permiso «reportes.ver»). */
export default async function ReportesPage() {
  await requerirPaginaPermiso("reportes.ver");
  return (
    <section className="space-y-4">
      <h1 className="page-title">Reportes</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/reportes/stock" className="card card-link">
          <div className="section-title">Stock valorizado</div>
          <p className="text-sm text-muted">Stock actual de cada producto en cada bodega, con su valor (cantidad × costo de compra).</p>
        </Link>
      </div>
    </section>
  );
}
