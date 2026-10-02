import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { mapaNombres } from "@/lib/catalogo-nombres";
import Badge from "@/components/app/badge";

// Precios y totales admiten hasta 2 decimales: se muestran exactos (sin redondear) para coincidir con la factura.
const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 2 });
const cant = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 });

const Dato = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div>
    <div className="label-block">{titulo}</div>
    <div>{children || "—"}</div>
  </div>
);

/** Detalle de una factura de compra en solo lectura (no hay formularios ni acciones). */
export default async function FacturaPage({ params }: { params: Promise<{ id: string }> }) {
  await requerirPaginaPermiso("compras.ver");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const { data: c } = await db.from("Compras")
    .select("*,Usuarios!Compras_IdUsuarioCreacion_fkey(Nombres,Apellidos)")
    .eq("IdCompra", id).maybeSingle<any>();
  if (!c) notFound();

  const [{ data: det }, formas, unidades, formatos] = await Promise.all([
    db.from("ComprasDetalle")
      .select("IdDetalle,CodigoProducto,Precio,Cantidad,Total,Productos!inner(NombreProducto,UnidadMedida,Formato)")
      .eq("IdProveedor", c.IdProveedor).eq("Folio", c.Folio).order("IdDetalle").returns<any[]>(),
    mapaNombres("FormasPago"), mapaNombres("UnidadesMedida"), mapaNombres("Formatos"),
  ]);
  const lineas = det ?? [];
  const registradoPor = c.Usuarios ? `${c.Usuarios.Nombres} ${c.Usuarios.Apellidos}` : "";
  const registradoEl = new Date(c.FechaRegistroCreacion).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });

  return (
    <section className="space-y-6">
      <Link href="/compras" className="link">← Compras</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Factura folio {c.Folio}</h1>
        {c.IdEstado === 1 ? <Badge tone="ok">Vigente</Badge> : <Badge tone="danger">Anulada</Badge>}
      </div>

      {c.IdEstado === 0 && (
        <div className="alert alert-error" role="status">
          <strong>Factura anulada.</strong> Motivo: {c.MotivoAnulacion || "no registrado"}
        </div>
      )}

      <div className="card">
        <h2 className="section-title mb-3">Datos de la factura</h2>
        <div className="form-grid form-grid-3">
          <Dato titulo="Proveedor">{c.NombreProveedor}</Dato>
          <Dato titulo="RUT">{c.RutProveedor}</Dato>
          <Dato titulo="Giro">{c.GiroProveedor}</Dato>
          <Dato titulo="Folio">{c.Folio}</Dato>
          <Dato titulo="Fecha de factura">{c.FechaFactura}</Dato>
          <Dato titulo="Fecha de recepción">{c.FechaRecepcion}</Dato>
          <Dato titulo="Forma de pago">{formas.get(c.FormaPago) ?? c.FormaPago}</Dato>
          <Dato titulo="Registrada por">{registradoPor}</Dato>
          <Dato titulo="Registrada el">{registradoEl}</Dato>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="section-title">Detalle</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Código</th><th>Producto</th><th>Formato</th><th>Unidad</th><th className="num">Cantidad</th><th className="num">Precio</th><th className="num">Total</th></tr>
            </thead>
            <tbody>
              {lineas.map((l) => (
                <tr key={l.IdDetalle}>
                  <td>{l.CodigoProducto}</td>
                  <td>{l.Productos.NombreProducto}</td>
                  <td>{formatos.get(l.Productos.Formato) ?? l.Productos.Formato}</td>
                  <td>{unidades.get(l.Productos.UnidadMedida) ?? l.Productos.UnidadMedida}</td>
                  <td className="num">{cant.format(Number(l.Cantidad))}</td>
                  <td className="num">{clp.format(Number(l.Precio))}</td>
                  <td className="num">{clp.format(Number(l.Total))}</td>
                </tr>
              ))}
              {lineas.length === 0 && <tr><td colSpan={7}>Sin líneas de detalle</td></tr>}
            </tbody>
            <tfoot>
              <tr><th colSpan={6} className="num">Neto</th><td className="num">{clp.format(Number(c.Neto))}</td></tr>
              <tr><th colSpan={6} className="num">IVA</th><td className="num">{clp.format(Number(c.Iva))}</td></tr>
              <tr><th colSpan={6} className="num">Total</th><td className="num"><strong>{clp.format(Number(c.Total))}</strong></td></tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
