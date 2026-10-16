import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { cargarTerritorio } from "@/lib/services/territorio";
import Aviso from "@/components/app/aviso";
import Icon from "@/components/app/icon";
import { FormProveedor, type Proveedor, type Sucursal, type Vendedor } from "./forms";
import { VistaSucursal, VistaVendedor } from "./vista-subformularios";
import { AVISOS, estadoBadge, href, nombresTerritorio, texto, type Contexto } from "./comun";

/** Editar: datos del proveedor y listados de sus sucursales y vendedores; cada uno se edita o agrega en su propia vista. */
export async function VistaEditar({ ctx, sel }: { ctx: Contexto; sel: Proveedor }) {
  const { sp, base, volverListado } = ctx;
  const [territorio, { data: sucs }, { data: vens }] = await Promise.all([
    cargarTerritorio(),
    db.from("ProveedoresSucursales").select("*").eq("IdProveedor", sel.IdProveedor).order("IdSucursal"),
    db.from("ProveedoresVendedores").select("*").eq("IdProveedor", sel.IdProveedor).order("IdVendedor"),
  ]);
  const sucursales = (sucs ?? []) as Sucursal[];
  const vendedores = (vens ?? []) as Vendedor[];
  const urlEdicion = (extra: Record<string, string | undefined> = {}) => href({ ...base, editar: String(sel.IdProveedor), ...extra });

  // Sucursal: editar una existente o agregar una nueva.
  const pSuc = texto(sp.sucursal);
  if (pSuc) {
    const suc = pSuc === "nueva" ? undefined : sucursales.find((x) => String(x.IdSucursal) === pSuc);
    if (pSuc === "nueva" || suc) return <VistaSucursal sel={sel} suc={suc} territorio={territorio} urlEdicion={urlEdicion} />;
  }
  // Vendedor: editar uno existente o agregar uno nuevo.
  const pVen = texto(sp.vendedor);
  if (pVen) {
    const ven = pVen === "nuevo" ? undefined : vendedores.find((x) => String(x.IdVendedor) === pVen);
    if (pVen === "nuevo" || ven) return <VistaVendedor sel={sel} ven={ven} urlEdicion={urlEdicion} />;
  }

  const { region, ciudad, comuna } = nombresTerritorio(territorio);
  const avisoEdicion = typeof sp.aviso === "string" ? AVISOS[sp.aviso] : undefined;
  return (
    <section className="space-y-6">
      <div className="page-head">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">Editar proveedor</h1>
          {avisoEdicion && <Aviso texto={avisoEdicion} />}
        </div>
        <Link href={volverListado} className="btn btn-secondary">Volver</Link>
      </div>
      <div className="card">
        <FormProveedor key={sel.IdProveedor} p={sel} territorio={territorio} despuesDeGuardar={href({ ...base, aviso: "editado" })} />
      </div>

      <div className="space-y-3">
        <div className="page-head">
          <h2 className="section-title">Sucursales</h2>
          <Link href={urlEdicion({ sucursal: "nueva" })} className="btn btn-primary"><Icon name="plus" size={18} />Agregar sucursal</Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Dirección</th><th>Región</th><th>Ciudad</th><th>Comuna</th><th>Teléfono</th><th>Correo</th><th>Encargado</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {sucursales.map((x) => (
                <tr key={x.IdSucursal}>
                  <td>{x.Direccion}</td><td>{region(x.Region)}</td><td>{ciudad(x.Ciudad)}</td><td>{comuna(x.Comuna)}</td>
                  <td>{x.Telefono}</td><td>{x.Correo}</td><td>{x.EncargadoSucursal}</td><td>{estadoBadge(x.IdEstado)}</td>
                  <td><Link className="link link-sm" href={urlEdicion({ sucursal: String(x.IdSucursal) })} aria-label={`Editar sucursal ${x.Direccion}`}>Editar</Link></td>
                </tr>
              ))}
              {!sucursales.length && <tr><td colSpan={9} className="text-muted">Este proveedor no tiene sucursales.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <div className="page-head">
          <h2 className="section-title">Vendedores</h2>
          <Link href={urlEdicion({ vendedor: "nuevo" })} className="btn btn-primary"><Icon name="plus" size={18} />Agregar vendedor</Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>RUT</th><th>Nombres</th><th>Apellidos</th><th>Teléfono</th><th>Correo</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {vendedores.map((v) => (
                <tr key={v.IdVendedor}>
                  <td>{v.Rut}</td><td>{v.Nombres}</td><td>{v.Apellidos}</td><td>{v.Telefono}</td><td>{v.Correo}</td><td>{estadoBadge(v.IdEstado)}</td>
                  <td><Link className="link link-sm" href={urlEdicion({ vendedor: String(v.IdVendedor) })} aria-label={`Editar vendedor ${v.Nombres} ${v.Apellidos}`}>Editar</Link></td>
                </tr>
              ))}
              {!vendedores.length && <tr><td colSpan={7} className="text-muted">Este proveedor no tiene vendedores.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
