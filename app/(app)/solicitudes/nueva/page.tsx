import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { mapaNombres } from "@/lib/catalogo-nombres";
import FormSolicitud from "../form-solicitud";

export default async function NuevaSolicitudPage() {
  await requerirPaginaPermiso("solicitudes.crear");
  const [{ data: bods }, { data: prods }, unidades] = await Promise.all([
    db.from("Bodegas").select("IdBodega,NombreBodega").eq("IdEstado", 1).eq("EsCentral", false).order("NombreBodega"),
    db.from("Productos").select("CodigoProducto,NombreProducto,UnidadMedida").eq("IdEstado", 1).order("NombreProducto"),
    mapaNombres("UnidadesMedida"),
  ]);
  return (
    <section className="space-y-4">
      <h1 className="page-title">Nueva solicitud</h1>
      <FormSolicitud
        bodegas={(bods ?? []).map((b) => ({ id: b.IdBodega, nombre: b.NombreBodega }))}
        productos={(prods ?? []).map((p) => ({ codigo: p.CodigoProducto, nombre: p.NombreProducto, unidad: unidades.get(p.UnidadMedida) ?? p.UnidadMedida }))}
      />
    </section>
  );
}
