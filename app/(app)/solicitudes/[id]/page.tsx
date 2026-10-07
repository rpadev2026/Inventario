import { etiquetaProducto } from "@/lib/producto-etiqueta";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { mapaNombres } from "@/lib/catalogo-nombres";
import { tienePermiso } from "@/lib/auth/permisos";
import { ESTADOS, ESTADO_TONO } from "../estados";
import Badge from "@/components/app/badge";
import { enviarSolicitud, rechazarSolicitud } from "../actions";
import { PanelAprobar, PanelRecepcion } from "../paneles";
import FormSolicitud from "../form-solicitud";

export default async function SolicitudPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requerirPaginaPermiso("solicitudes.ver_propias", "solicitudes.gestionar");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const { data: sol } = await db.from("Solicitudes")
    .select("*,Bodegas!inner(NombreBodega),Usuarios!Solicitudes_IdUsuarioSolicitante_fkey!inner(Nombres,Apellidos)")
    .eq("IdSolicitud", id).maybeSingle<any>();
  if (!sol) notFound();

  const bodeguero = tienePermiso(s.permisos, "solicitudes.gestionar");
  const esDueno = sol.IdUsuarioSolicitante === s.uid;
  if (!bodeguero && !esDueno) notFound(); // un solicitante no ve solicitudes ajenas

  const [{ data: det }, { data: hist }, { data: stock }, unidades] = await Promise.all([
    db.from("SolicitudesDetalle").select("IdProducto,Cantidad,CantidadAprobada,CantidadRecibida,Productos!inner(Codigo,Nombre,UnidadMedida)").eq("IdSolicitud", id).returns<any[]>(),
    db.from("HistorialSolicitudes").select("EstadoSolicitud,FechaIngreso,Usuarios!HistorialSolicitudes_IdUsuarioCreacion_fkey(Nombres,Apellidos)").eq("IdSolicitud", id).order("IdHistorial").returns<any[]>(),
    db.from("StockBodega").select("IdProducto,Cantidad,Bodegas!inner(EsCentral)").eq("Bodegas.EsCentral", true).returns<any[]>(),
    mapaNombres("UnidadesMedida"),
  ]);
  const nombreUnidad = (c: string) => unidades.get(c) ?? c;
  const detalle = det ?? [];
  const stockCentral = new Map((stock ?? []).map((r) => [r.IdProducto as number, Number(r.Cantidad)]));
  const estado: number = sol.EstadoSolicitud;

  const edicion = estado === 0 && esDueno
    ? await Promise.all([
        db.from("Bodegas").select("IdBodega,NombreBodega").eq("IdEstado", 1).eq("EsCentral", false).order("NombreBodega"),
        db.from("Productos").select("IdProducto,Codigo,Nombre,UnidadMedida").eq("IdEstado", 1).order("Nombre"),
      ])
    : null;

  return (
    <section className="space-y-4">
      <Link href="/solicitudes" className="link">← Solicitudes</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-title">Solicitud #{sol.NumeroSolicitud}</h1>
        <Badge tone={ESTADO_TONO[estado]}>{ESTADOS[estado]}</Badge>
      </div>
      <p className="text-sm text-muted">
        {sol.Usuarios?.Nombres} {sol.Usuarios?.Apellidos} · Destino: {sol.Bodegas.NombreBodega} · {new Date(sol.FechaSolicitud).toLocaleDateString("es-CL")}
      </p>

      {edicion ? (
        <>
          <FormSolicitud
            bodegas={(edicion[0].data ?? []).map((b) => ({ id: b.IdBodega, nombre: b.NombreBodega }))}
            productos={(edicion[1].data ?? []).map((p) => ({ id: p.IdProducto as number, codigo: p.Codigo as string | null, nombre: p.Nombre as string, unidad: nombreUnidad(p.UnidadMedida) }))}
            inicial={{ idSolicitud: id, idBodega: sol.IdBodegaDestino, lineas: detalle.map((d) => ({ producto: String(d.IdProducto), cantidad: String(d.Cantidad) })) }}
          />
          <form action={enviarSolicitud}>
            <input type="hidden" name="id" value={id} />
            <button className="btn btn-secondary">Enviar solicitud</button>
          </form>
        </>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Producto</th><th>Solicitada</th><th>Aprobada</th><th>Recibida</th></tr></thead>
            <tbody>
              {detalle.map((d) => (
                <tr key={d.IdProducto}>
                  <td>{etiquetaProducto(d.Productos.Codigo, d.Productos.Nombre)}</td>
                  <td>{d.Cantidad} {nombreUnidad(d.Productos.UnidadMedida)}</td><td>{d.CantidadAprobada ?? "—"}</td><td>{d.CantidadRecibida}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {estado === 1 && bodeguero && !esDueno && (
        <>
          <PanelAprobar id={id} items={detalle.map((d) => {
            const disp = stockCentral.get(d.IdProducto) ?? 0;
            const max = Math.min(Number(d.Cantidad), disp);
            return { producto: d.IdProducto as number, nombre: `${etiquetaProducto(d.Productos.Codigo, d.Productos.Nombre)} · stock central ${disp}`, max, inicial: max };
          })} />
          <form action={rechazarSolicitud}>
            <input type="hidden" name="id" value={id} />
            <button className="btn btn-danger">Rechazar solicitud</button>
          </form>
        </>
      )}

      {(estado === 2 || estado === 4) && esDueno && (
        <PanelRecepcion key={detalle.map((d) => `${d.IdProducto}:${d.CantidadRecibida}`).join()} id={id} items={detalle
          .filter((d) => Number(d.CantidadAprobada ?? 0) - Number(d.CantidadRecibida) > 0)
          .map((d) => {
            const pend = Number(d.CantidadAprobada) - Number(d.CantidadRecibida);
            return { producto: d.IdProducto as number, nombre: etiquetaProducto(d.Productos.Codigo, d.Productos.Nombre), max: pend, inicial: pend };
          })} />
      )}

      <div className="card">
        <h2 className="section-title mb-3">Historial</h2>
        <ul className="text-sm space-y-1">
          {(hist ?? []).map((h, i) => (
            <li key={i}>{new Date(h.FechaIngreso).toLocaleString("es-CL")} — {ESTADOS[h.EstadoSolicitud]}
              {h.Usuarios && <span className="text-muted"> · {h.Usuarios.Nombres} {h.Usuarios.Apellidos}</span>}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
