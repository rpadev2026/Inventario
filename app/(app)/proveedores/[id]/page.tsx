import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { cargarTerritorio } from "@/lib/services/territorio";
import { FormProveedor, FormSucursal, FormVendedor, type Proveedor, type Sucursal, type Vendedor } from "../forms";

export default async function ProveedorPage({ params }: { params: Promise<{ id: string }> }) {
  await requerirPaginaPermiso("proveedores.ver");
  const idProv = Number((await params).id);
  if (!Number.isInteger(idProv) || idProv <= 0) notFound();
  const [{ data: p }, { data: sucs }, { data: vens }, territorio] = await Promise.all([
    db.from("Proveedores").select("*").eq("IdProveedor", idProv).maybeSingle(),
    db.from("ProveedoresSucursales").select("*").eq("IdProveedor", idProv).order("IdSucursal"),
    db.from("ProveedoresVendedores").select("*").eq("IdProveedor", idProv).order("IdVendedor"),
    cargarTerritorio(),
  ]);
  if (!p) notFound();
  return (
    <section className="space-y-6">
      <Link href="/proveedores" className="link">← Proveedores</Link>
      <h1 className="page-title">{p.RazonSocial}</h1>
      <div className="card"><FormProveedor territorio={territorio} p={p as Proveedor} /></div>

      <div className="card space-y-3">
        <h2 className="section-title">Sucursales</h2>
        {(sucs as Sucursal[] ?? []).map((s) => <FormSucursal territorio={territorio} key={s.IdSucursal} idProveedor={idProv} s={s} />)}
        <h3 className="section-title pt-2">Nueva sucursal</h3>
        <FormSucursal territorio={territorio} idProveedor={idProv} />
      </div>

      <div className="card space-y-3">
        <h2 className="section-title">Vendedores</h2>
        {(vens as Vendedor[] ?? []).map((v) => <FormVendedor key={v.IdVendedor} idProveedor={idProv} v={v} />)}
        <h3 className="section-title pt-2">Nuevo vendedor</h3>
        <FormVendedor idProveedor={idProv} />
      </div>
    </section>
  );
}
