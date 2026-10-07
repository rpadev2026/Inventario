import { etiquetaProducto } from "@/lib/producto-etiqueta";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";

export default async function MovimientosPage() {
  await requerirPaginaPermiso("movimientos.ver");
  const { data } = await db.from("MovimientosBodega")
    .select("IdMovimiento,FechaMovimiento,IdSolicitud,Cantidad,Productos!inner(Codigo,Nombre),Origen:Bodegas!MovimientosBodega_IdBodegaOrigen_fkey(NombreBodega),Destino:Bodegas!MovimientosBodega_IdBodegaDestino_fkey(NombreBodega)")
    .order("IdMovimiento", { ascending: false }).limit(200).returns<any[]>();
  return (
    <section className="space-y-4">
      <h1 className="page-title">Movimientos de bodega</h1>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Fecha</th><th>Solicitud</th><th>Origen</th><th>Destino</th><th>Producto</th><th>Cantidad</th></tr></thead>
          <tbody>
            {(data ?? []).map((m) => (
              <tr key={m.IdMovimiento}>
                <td>{new Date(m.FechaMovimiento).toLocaleString("es-CL")}</td>
                <td>{m.IdSolicitud ?? "—"}</td><td>{m.Origen.NombreBodega}</td><td>{m.Destino.NombreBodega}</td>
                <td>{etiquetaProducto(m.Productos.Codigo, m.Productos.Nombre)}</td><td>{m.Cantidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
