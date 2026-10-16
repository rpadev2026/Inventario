import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { cargarTerritorio } from "@/lib/services/territorio";
import type { Proveedor, Sucursal, Vendedor } from "./forms";
import { Dato, estadoBadge, nombresTerritorio, type Contexto } from "./comun";

/** Ver: datos del proveedor, sus sucursales y sus vendedores (solo lectura). */
export async function VistaDetalle({ ctx, sel }: { ctx: Contexto; sel: Proveedor }) {
  const { volverListado } = ctx;
  const [territorio, { data: sucs }, { data: vens }] = await Promise.all([
    cargarTerritorio(),
    db.from("ProveedoresSucursales").select("*").eq("IdProveedor", sel.IdProveedor).order("IdSucursal"),
    db.from("ProveedoresVendedores").select("*").eq("IdProveedor", sel.IdProveedor).order("IdVendedor"),
  ]);
  const { region, ciudad, comuna } = nombresTerritorio(territorio);
  return (
    <section className="space-y-6">
      <div className="page-head">
        <h1 className="page-title">{sel.RazonSocial}</h1>
        <Link href={volverListado} className="btn btn-secondary">Volver</Link>
      </div>
      <div className="card">
        <div className="form-grid form-grid-3">
          <Dato titulo="RUT">{sel.Rut}</Dato>
          <Dato titulo="Giro">{sel.Giro}</Dato>
          <Dato titulo="Estado">{estadoBadge(sel.IdEstado)}</Dato>
          <Dato titulo="Dirección">{sel.Direccion}</Dato>
          <Dato titulo="Región">{region(sel.Region)}</Dato>
          <Dato titulo="Ciudad (provincia)">{ciudad(sel.Ciudad)}</Dato>
          <Dato titulo="Comuna">{comuna(sel.Comuna)}</Dato>
          <Dato titulo="Teléfono">{sel.Telefono}</Dato>
          <Dato titulo="Correo">{sel.Correo}</Dato>
          <Dato titulo="RUT representante legal">{sel.RutRepresentanteLegal}</Dato>
          <Dato titulo="Nombre representante legal">{sel.NombreRepresentanteLegal}</Dato>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="section-title">Sucursales</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Dirección</th><th>Región</th><th>Ciudad</th><th>Comuna</th><th>Teléfono</th><th>Correo</th><th>Encargado</th><th>Estado</th></tr></thead>
            <tbody>
              {((sucs ?? []) as Sucursal[]).map((s) => (
                <tr key={s.IdSucursal}>
                  <td>{s.Direccion}</td><td>{region(s.Region)}</td><td>{ciudad(s.Ciudad)}</td><td>{comuna(s.Comuna)}</td>
                  <td>{s.Telefono}</td><td>{s.Correo}</td><td>{s.EncargadoSucursal}</td><td>{estadoBadge(s.IdEstado)}</td>
                </tr>
              ))}
              {!sucs?.length && <tr><td colSpan={8} className="text-muted">Este proveedor no tiene sucursales.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="section-title">Vendedores</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>RUT</th><th>Nombres</th><th>Apellidos</th><th>Teléfono</th><th>Correo</th><th>Estado</th></tr></thead>
            <tbody>
              {((vens ?? []) as Vendedor[]).map((v) => (
                <tr key={v.IdVendedor}>
                  <td>{v.Rut}</td><td>{v.Nombres}</td><td>{v.Apellidos}</td><td>{v.Telefono}</td><td>{v.Correo}</td><td>{estadoBadge(v.IdEstado)}</td>
                </tr>
              ))}
              {!vens?.length && <tr><td colSpan={6} className="text-muted">Este proveedor no tiene vendedores.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
