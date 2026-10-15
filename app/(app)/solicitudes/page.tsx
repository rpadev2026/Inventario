import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { tienePermiso } from "@/lib/auth/permisos";
import { ESTADOS, ESTADO_TONO } from "./estados";
import Badge from "@/components/app/badge";
import Field from "@/components/app/field";
import Paginador from "@/components/app/paginador";
import { paginar } from "@/lib/paginacion";

export default async function SolicitudesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await requerirPaginaPermiso("solicitudes.ver_propias", "solicitudes.gestionar");
  // El solicitante ve solo las suyas; quien gestiona solicitudes ve todas.
  const ve_todas = tienePermiso(s.permisos, "solicitudes.gestionar");
  // Estado pedido en la URL (0–5); cualquier otro valor = todos.
  const estadoPedido = typeof sp.estado === "string" && /^[0-5]$/.test(sp.estado) ? Number(sp.estado) : undefined;
  const filtro = {
    ...(ve_todas ? {} : { IdUsuarioSolicitante: s.uid }),
    ...(estadoPedido === undefined ? {} : { EstadoSolicitud: estadoPedido }),
  };
  // Total con el mismo filtro y luego solo la página pedida (más recientes primero).
  const { count, error: errCount } = await db.from("Solicitudes").select("IdSolicitud", { count: "exact", head: true }).match(filtro);
  if (errCount) throw new Error("No se pudo cargar las solicitudes");
  const pg = paginar({ pagina: sp.pagina, tam: sp.tam }, count ?? 0);
  const { data, error } = await db.from("Solicitudes")
    .select("IdSolicitud,NumeroSolicitud,FechaSolicitud,EstadoSolicitud,IdUsuarioSolicitante,Bodegas!inner(NombreBodega),Usuarios!Solicitudes_IdUsuarioSolicitante_fkey!inner(Nombres,Apellidos)")
    .match(filtro).order("IdSolicitud", { ascending: false }).range(pg.from, pg.to);
  if (error) throw new Error("No se pudo cargar las solicitudes");
  const puedeCrear = tienePermiso(s.permisos, "solicitudes.crear");
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Solicitudes</h1>
        {puedeCrear && <Link href="/solicitudes/nueva" className="btn btn-primary">Nueva solicitud</Link>}
      </div>
      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filtrar solicitudes">
        <Field label="Estado">
          <select name="estado" defaultValue={estadoPedido ?? ""} className="input">
            <option value="">Todos</option>
            {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        {typeof sp.tam === "string" && <input type="hidden" name="tam" value={pg.tam} />}
        <button className="btn btn-secondary">Filtrar</button>
        {estadoPedido !== undefined && <Link href="/solicitudes" className="link">Limpiar</Link>}
      </form>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>N°</th><th>Fecha</th><th>Solicitante</th><th>Bodega destino</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.IdSolicitud}>
                <td>{r.NumeroSolicitud}</td>
                <td>{new Date(r.FechaSolicitud).toLocaleDateString("es-CL")}</td>
                <td>{r.Usuarios.Nombres} {r.Usuarios.Apellidos}</td>
                <td>{r.Bodegas.NombreBodega}</td>
                <td><Badge tone={ESTADO_TONO[r.EstadoSolicitud]}>{ESTADOS[r.EstadoSolicitud]}</Badge></td>
                <td><Link className="link link-sm" href={`/solicitudes/${r.IdSolicitud}`}>Ver</Link></td>
              </tr>
            ))}
            {!(data ?? []).length && <tr><td colSpan={6} className="text-muted">{estadoPedido !== undefined ? "Sin solicitudes en ese estado." : "Sin solicitudes."}</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginador pg={pg} etiqueta="solicitudes" />
    </section>
  );
}
