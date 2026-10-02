import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { tienePermiso } from "@/lib/auth/permisos";
import { mapaNombres } from "@/lib/catalogo-nombres";
import AnularFactura from "./anular";
import Badge from "@/components/app/badge";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default async function ComprasPage() {
  const sesion = await requerirPaginaPermiso("compras.ver");
  const puedeRegistrar = tienePermiso(sesion.permisos, "compras.registrar");
  const nombreForma = await mapaNombres("FormasPago");
  const { data } = await db.from("Compras")
    .select("IdCompra,NombreProveedor,RutProveedor,Folio,FechaFactura,FechaRecepcion,FormaPago,Total,IdEstado,MotivoAnulacion")
    .order("IdCompra", { ascending: false }).limit(100);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Compras</h1>
        {puedeRegistrar && <Link href="/compras/nueva" className="btn btn-primary">Nueva factura</Link>}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Folio</th><th>Proveedor</th><th>Fecha factura</th><th>Recepción</th><th>Pago</th><th className="num">Total</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.IdCompra}>
                <td>{c.Folio}</td><td>{c.NombreProveedor} <span className="text-muted">({c.RutProveedor})</span></td>
                <td>{c.FechaFactura}</td><td>{c.FechaRecepcion}</td><td>{nombreForma.get(c.FormaPago) ?? c.FormaPago}</td>
                <td className="num">{clp.format(c.Total)}</td>
                <td>{c.IdEstado === 1 ? <Badge tone="ok">Vigente</Badge> : <span title={c.MotivoAnulacion ?? ""}><Badge tone="danger">Anulada</Badge></span>}</td>
                <td>
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
                    <Link className="link link-sm" href={`/compras/${c.IdCompra}`} aria-label={`Ver factura folio ${c.Folio}`}>Ver</Link>
                    {c.IdEstado === 1 && <AnularFactura id={c.IdCompra} folio={c.Folio} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
