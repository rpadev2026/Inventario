import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { leerSesion } from "@/lib/auth/session";
import { tienePermiso } from "@/lib/auth/permisos";

function Tarjeta({ titulo, valor, href, alerta }: { titulo: string; valor: number; href: string; alerta?: boolean }) {
  return (
    <Link href={href} className={`card card-link ${alerta && valor > 0 ? "card-alert" : ""}`}>
      <div className="kpi-value">{valor}</div>
      <div className="text-sm text-muted">{titulo}</div>
    </Link>
  );
}

export default async function Inicio({ searchParams }: { searchParams: Promise<{ acceso?: string }> }) {
  const { acceso } = await searchParams;
  const s = (await leerSesion())!;
  const bodeguero = tienePermiso(s.permisos, "solicitudes.gestionar");
  const solicitante = tienePermiso(s.permisos, "solicitudes.crear");

  const [pendientes, porRecibir, stock, prods] = await Promise.all([
    bodeguero ? db.from("Solicitudes").select("IdSolicitud", { count: "exact", head: true }).eq("EstadoSolicitud", 1) : null,
    solicitante ? db.from("Solicitudes").select("IdSolicitud", { count: "exact", head: true }).in("EstadoSolicitud", [2, 4]).eq("IdUsuarioSolicitante", s.uid) : null,
    bodeguero ? db.from("StockBodega").select("IdProducto,Cantidad,Bodegas!inner(EsCentral)").eq("Bodegas.EsCentral", true).returns<any[]>() : null,
    bodeguero ? db.from("Productos").select("IdProducto,StockMinimo,StockCritico").eq("IdEstado", 1) : null,
  ]);
  const st = new Map((stock?.data ?? []).map((r) => [r.IdProducto as number, Number(r.Cantidad)]));
  const bajos = (prods?.data ?? []).filter((p) => (st.get(p.IdProducto) ?? 0) <= Number(p.StockMinimo) && Number(p.StockMinimo) > 0);
  const criticos = bajos.filter((p) => (st.get(p.IdProducto) ?? 0) <= Number(p.StockCritico));

  return (
    <section className="space-y-4">
      {acceso === "denegado" && (
        <p role="alert" className="alert alert-error">
          Acceso denegado: su rol no tiene permiso para ese módulo.
        </p>
      )}
      <h1 className="page-title">Resumen</h1>
      <div className="grid gap-3 sm:grid-cols-4">
        {pendientes && <Tarjeta titulo="Solicitudes por aprobar" valor={pendientes.count ?? 0} href="/solicitudes" />}
        {porRecibir && <Tarjeta titulo="Mis solicitudes por recepcionar" valor={porRecibir.count ?? 0} href="/solicitudes" />}
        {stock && <Tarjeta titulo="Productos bajo mínimo (Central)" valor={bajos.length} href="/bodegas" alerta />}
        {stock && <Tarjeta titulo="Productos en nivel crítico" valor={criticos.length} href="/bodegas" alerta />}
      </div>
    </section>
  );
}
