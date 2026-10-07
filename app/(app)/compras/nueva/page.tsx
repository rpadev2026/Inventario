import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import FormFactura from "./form-factura";

export default async function NuevaFacturaPage({ searchParams }: { searchParams: Promise<{ proveedor?: string; producto?: string }> }) {
  await requerirPaginaPermiso("compras.registrar");
  const { proveedor, producto } = await searchParams;
  const [{ data: provs }, { data: prods }, { data: formas }] = await Promise.all([
    db.from("Proveedores").select("IdProveedor,RazonSocial,Rut").eq("IdEstado", 1).order("RazonSocial"),
    db.from("Productos").select("IdProducto,Codigo,Nombre").eq("IdEstado", 1).order("Nombre"),
    db.from("FormasPago").select("Codigo,Nombre").eq("IdEstado", 1).order("Nombre"),
  ]);
  return (
    <section className="space-y-4">
      <h1 className="page-title">Nueva factura</h1>
      <FormFactura
        preProveedor={typeof proveedor === "string" ? proveedor : undefined}
        preProducto={typeof producto === "string" ? producto : undefined}
        proveedores={(provs ?? []).map((p) => ({ id: p.IdProveedor, rut: p.Rut, nombre: p.RazonSocial }))}
        productos={(prods ?? []).map((p) => ({ id: p.IdProducto as number, codigo: p.Codigo as string | null, nombre: p.Nombre as string }))}
        formasPago={(formas ?? []).map((f) => ({ codigo: f.Codigo, nombre: f.Nombre }))}
      />
    </section>
  );
}
