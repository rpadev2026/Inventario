import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import FormSolicitud from "../form-solicitud";

export default async function NuevaSolicitudPage() {
  await requerirPaginaPermiso("solicitudes.crear");
  const { data: bods } = await db.from("Bodegas").select("IdBodega,NombreBodega").eq("IdEstado", 1).eq("EsCentral", false).order("NombreBodega");
  return (
    <section className="space-y-4">
      <h1 className="page-title">Nueva solicitud</h1>
      <FormSolicitud
        bodegas={(bods ?? []).map((b) => ({ id: b.IdBodega, nombre: b.NombreBodega }))}
      />
    </section>
  );
}
