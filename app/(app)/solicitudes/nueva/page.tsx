import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { mapaNombres } from "@/lib/catalogo-nombres";
import FormSolicitud from "../form-solicitud";

export default async function NuevaSolicitudPage() {
  await requerirPaginaPermiso("solicitudes.crear");
  const [{ data: bods }, { data: prods }, unidades] = await Promise.all([
    db.from("Bodegas").select("IdBodega,NombreBodega").eq("IdEstado", 1).eq("EsCentral", false).order("NombreBodega"),
    db.from("Productos").select("IdProducto,Codigo,Nombre,UnidadMedida").eq("IdEstado", 1).order("Nombre"),
    mapaNombres("UnidadesMedida"),
  ]);
  return (
    <section className="space-y-4">
      <h1 className="page-title">Nueva solicitud</h1>
      <FormSolicitud
        bodegas={(bods ?? []).map((b) => ({ id: b.IdBodega, nombre: b.NombreBodega }))}
        productos={(prods ?? []).map((p) => ({ id: p.IdProducto as number, codigo: p.Codigo as string | null, nombre: p.Nombre as string, unidad: unidades.get(p.UnidadMedida) ?? p.UnidadMedida }))}
      />
    </section>
  );
}
