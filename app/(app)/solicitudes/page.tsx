import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { tienePermiso } from "@/lib/auth/permisos";
import { ESTADOS, ESTADO_TONO } from "./estados";
import Badge from "@/components/app/badge";

export default async function SolicitudesPage() {
  const s = await requerirPaginaPermiso("solicitudes.ver_propias", "solicitudes.gestionar");
  // El solicitante ve solo las suyas; quien gestiona solicitudes ve todas.
  const ve_todas = tienePermiso(s.permisos, "solicitudes.gestionar");
  let q = db.from("Solicitudes")
    .select("IdSolicitud,NumeroSolicitud,FechaSolicitud,EstadoSolicitud,IdUsuarioSolicitante,Bodegas!inner(NombreBodega),Usuarios!Solicitudes_IdUsuarioSolicitante_fkey!inner(Nombres,Apellidos)")
    .order("IdSolicitud", { ascending: false }).limit(100);
  if (!ve_todas) q = q.eq("IdUsuarioSolicitante", s.uid);
  const { data } = await q.returns<any[]>();
  const puedeCrear = tienePermiso(s.permisos, "solicitudes.crear");
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Solicitudes</h1>
        {puedeCrear && <Link href="/solicitudes/nueva" className="btn btn-primary">Nueva solicitud</Link>}
      </div>
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
          </tbody>
        </table>
      </div>
    </section>
  );
}
