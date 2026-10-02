import Link from "next/link";
import Badge from "@/components/app/badge";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { rutaVolverSegura } from "@/lib/volver";
import { cargarTerritorio } from "@/lib/services/territorio";
import { FormProveedor } from "./forms";

export default async function ProveedoresPage({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  await requerirPaginaPermiso("proveedores.ver");
  const { volver } = await searchParams;
  const rutaVolver = rutaVolverSegura(volver);
  const [{ data }, territorio] = await Promise.all([
    db.from("Proveedores").select("IdProveedor,Rut,RazonSocial,Giro,Telefono,Correo,IdEstado").order("RazonSocial"),
    cargarTerritorio(),
  ]);
  return (
    <section className="space-y-6">
      <h1 className="page-title">Proveedores</h1>
      {rutaVolver && <Link href={rutaVolver} className="link">← Volver a la factura</Link>}
      <div className="card">
        <h2 className="section-title mb-3">Nuevo proveedor</h2>
        <FormProveedor territorio={territorio} volver={rutaVolver ?? undefined} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>RUT</th><th>Razón social</th><th>Giro</th><th>Teléfono</th><th>Correo</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {(data ?? []).map((p) => (
              <tr key={p.IdProveedor}>
                <td>{p.Rut}</td><td>{p.RazonSocial}</td><td>{p.Giro}</td><td>{p.Telefono}</td><td>{p.Correo}</td>
                <td><Badge tone={p.IdEstado === 1 ? "ok" : "neutral"}>{p.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge></td>
                <td><Link className="link link-sm" href={`/proveedores/${p.IdProveedor}`}>Ver / editar</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
