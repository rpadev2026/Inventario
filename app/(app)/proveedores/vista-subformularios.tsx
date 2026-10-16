import Link from "next/link";
import { FormSucursal, FormVendedor, type Proveedor, type Sucursal, type Vendedor } from "./forms";
import type { Territorio } from "./comun";

/** Sucursal: editar una existente o agregar una nueva; solo su formulario, con Volver a la edición del proveedor. */
export function VistaSucursal({ sel, suc, territorio, urlEdicion }: {
  sel: Proveedor; suc?: Sucursal; territorio: Territorio; urlEdicion: (extra?: Record<string, string | undefined>) => string;
}) {
  const nueva = !suc;
  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">{nueva ? "Agregar sucursal" : "Editar sucursal"}</h1>
        <Link href={urlEdicion()} className="btn btn-secondary">Volver</Link>
      </div>
      <p className="text-muted">Proveedor: {sel.RazonSocial}</p>
      <div className="card">
        <FormSucursal key={suc?.IdSucursal ?? "nueva"} idProveedor={sel.IdProveedor} s={suc} territorio={territorio}
          despuesDeGuardar={urlEdicion({ aviso: nueva ? "sucursal-creada" : "sucursal-editada" })} />
      </div>
    </section>
  );
}

/** Vendedor: editar uno existente o agregar uno nuevo; solo su formulario, con Volver a la edición del proveedor. */
export function VistaVendedor({ sel, ven, urlEdicion }: {
  sel: Proveedor; ven?: Vendedor; urlEdicion: (extra?: Record<string, string | undefined>) => string;
}) {
  const nuevo = !ven;
  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">{nuevo ? "Agregar vendedor" : "Editar vendedor"}</h1>
        <Link href={urlEdicion()} className="btn btn-secondary">Volver</Link>
      </div>
      <p className="text-muted">Proveedor: {sel.RazonSocial}</p>
      <div className="card">
        <FormVendedor key={ven?.IdVendedor ?? "nuevo"} idProveedor={sel.IdProveedor} v={ven}
          despuesDeGuardar={urlEdicion({ aviso: nuevo ? "vendedor-creado" : "vendedor-editado" })} />
      </div>
    </section>
  );
}
