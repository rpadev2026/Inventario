import Link from "next/link";
import Badge from "@/components/app/badge";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { rutaVolverSegura } from "@/lib/volver";
import { cargarCatalogo } from "@/lib/catalogo-nombres";
import FormProducto, { type Producto } from "./form";

export default async function ProductosPage({ searchParams }: { searchParams: Promise<{ editar?: string; volver?: string }> }) {
  await requerirPaginaPermiso("productos.ver");
  const { editar, volver } = await searchParams;
  const rutaVolver = rutaVolverSegura(volver);
  const [{ data }, unidades, formatos] = await Promise.all([
    db.from("Productos").select("*").order("NombreProducto"),
    cargarCatalogo("UnidadesMedida"), cargarCatalogo("Formatos"),
  ]);
  const nombreUnidad = new Map(unidades.map((i) => [i.Codigo, i.Nombre]));
  const nombreFormato = new Map(formatos.map((i) => [i.Codigo, i.Nombre]));
  const lista = (data ?? []) as Producto[];
  const enEdicion = lista.find((p) => p.CodigoProducto === editar);
  return (
    <section className="space-y-6">
      <h1 className="page-title">Productos</h1>
      {rutaVolver && <Link href={rutaVolver} className="link">← Volver a la factura</Link>}
      <div className="card">
        <h2 className="section-title mb-3">{enEdicion ? `Editar ${enEdicion.CodigoProducto}` : "Nuevo producto"}</h2>
        <FormProducto key={enEdicion?.CodigoProducto ?? "nuevo"} p={enEdicion} unidades={unidades} formatos={formatos} volver={rutaVolver ?? undefined} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Código</th><th>Nombre</th><th>Unidad</th><th>Formato</th><th>Mín.</th><th>Crít.</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.CodigoProducto}>
                <td>{p.CodigoProducto}</td><td>{p.NombreProducto}</td><td>{nombreUnidad.get(p.UnidadMedida) ?? p.UnidadMedida}</td><td>{nombreFormato.get(p.Formato) ?? p.Formato}</td>
                <td>{p.StockMinimo}</td><td>{p.StockCritico}</td><td><Badge tone={p.IdEstado === 1 ? "ok" : "neutral"}>{p.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge></td>
                <td><Link className="link link-sm" href={`/productos?editar=${encodeURIComponent(p.CodigoProducto)}`}>Editar</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
