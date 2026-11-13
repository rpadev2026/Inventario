import Link from "next/link";
import { after } from "next/server";
import { cerrarCaducadas } from "@/lib/services/caducidad";
import { db } from "@/lib/db/supabase";
import { leerTodo } from "@/lib/db/leer-todo";
import { esAdmin, leerSesion } from "@/lib/auth/session";
import { tienePermiso } from "@/lib/auth/permisos";
import { cargarBandeja } from "@/lib/services/bandeja";
import BandejaSolicitudes from "./bandeja-solicitudes";
import ActivarAvisos from "@/components/app/activar-avisos";

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

  // Respaldo sin cron: quien gestiona, al abrir el Inicio, cierra las aprobadas parcialmente que ya caducaron (la función SQL es idempotente).
  if (bodeguero) after(() => cerrarCaducadas());

  const veSolicitudes = tienePermiso(s.permisos, "solicitudes.ver_propias", "solicitudes.gestionar");

  const [pendientes, porRecibir, stock, prods, bandeja] = await Promise.all([
    bodeguero ? db.from("Solicitudes").select("IdSolicitud", { count: "exact", head: true }).eq("EstadoSolicitud", 1) : null,
    solicitante ? db.from("Solicitudes").select("IdSolicitud", { count: "exact", head: true }).in("EstadoSolicitud", [2, 4]).eq("IdUsuarioSolicitante", s.uid) : null,
    bodeguero ? leerTodo((a, b) => db.from("StockBodega").select("IdProducto,Cantidad,Bodegas!inner(EsCentral)", { count: "exact" }).eq("Bodegas.EsCentral", true).order("IdProducto").range(a, b)) : null,
    bodeguero ? leerTodo((a, b) => db.from("Productos").select("IdProducto,StockMinimo,StockCritico", { count: "exact" }).eq("IdEstado", 1).order("IdProducto").range(a, b)) : null,
    // Si la bandeja falla no se cae el Inicio: se muestra un aviso en su lugar.
    veSolicitudes ? cargarBandeja({ uid: s.uid, gestiona: bodeguero, admin: esAdmin(s) }).catch((e) => { console.error("[inicio] bandeja:", (e as Error).message); return null; }) : undefined,
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
      {veSolicitudes && <ActivarAvisos clavePublica={process.env.VAPID_PUBLIC_KEY || undefined} />}
      {veSolicitudes && (bandeja ? <BandejaSolicitudes items={bandeja.items} total={bandeja.total} /> : <BandejaSolicitudes items={[]} total={0} error />)}
    </section>
  );
}
