"use client";
import { useRouter } from "next/navigation";
import { useAccion } from "@/lib/use-accion";
import { rutaVolverSegura } from "@/lib/volver";
import Field from "@/components/app/field";
import CampoCorreo from "@/components/app/campo-correo";
import SelectorTerritorio from "@/components/app/selector-territorio";
import type { Territorio } from "@/lib/territorio-opciones";
import { guardarProveedor, guardarSucursal, guardarVendedor } from "./actions";

type Msg = { error?: string; ok?: boolean } | undefined;
const Estado = ({ s }: { s: Msg }) => (
  <>
    {s?.error && <span role="alert" className="msg msg-error">{s.error}</span>}
    {s?.ok && <span role="status" className="msg msg-ok">Guardado</span>}
  </>
);
const EstadoSelect = ({ valor }: { valor?: number }) => (
  <Field label="Estado">
    <select name="estado" defaultValue={valor ?? 1} className="input"><option value={1}>Vigente</option><option value={0}>No vigente</option></select>
  </Field>
);

export type Proveedor = {
  IdProveedor: number; Rut: string; RazonSocial: string; Direccion: string | null; Region: string | null; Comuna: string | null;
  Ciudad: string | null; Giro: string | null; RutRepresentanteLegal: string | null; NombreRepresentanteLegal: string | null;
  Telefono: string | null; Correo: string | null; IdEstado: number;
};

export function FormProveedor({ p, volver, territorio, despuesDeGuardar }: {
  p?: Proveedor; territorio: Territorio;
  /** Ruta de origen (p. ej. la factura): al crear, vuelve ahí con el proveedor elegido. */
  volver?: string;
  /** Si no hay ruta de origen, al guardar bien se va a esta ruta (el listado, con el aviso). */
  despuesDeGuardar?: string;
}) {
  const router = useRouter();
  const { state, pending, onSubmit } = useAccion(guardarProveedor, {
    limpiarSiOk: !p,
    onOk: (r) => {
      // Solo al crear: vuelve a la pantalla de origen (ruta interna segura) con el nuevo proveedor elegido.
      const ruta = rutaVolverSegura(volver);
      if (!p && r.id && ruta) router.push(`${ruta}?proveedor=${encodeURIComponent(String(r.id))}`);
      else if (despuesDeGuardar) router.push(despuesDeGuardar);
    },
  });
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {p && <input type="hidden" name="idProveedor" value={p.IdProveedor} />}
      <div className="form-grid form-grid-3">
        <Field label="RUT" hint="Ej: 76086428-5"><input name="rut" defaultValue={p?.Rut} required className="input" autoComplete="off" /></Field>
        <Field label="Razón social" className="fld-2"><input name="razonSocial" defaultValue={p?.RazonSocial} required className="input" /></Field>
        <Field label="Giro" className="fld-full"><input name="giro" defaultValue={p?.Giro ?? ""} className="input" /></Field>
        <Field label="Dirección" className="fld-full"><input name="direccion" defaultValue={p?.Direccion ?? ""} className="input" autoComplete="street-address" /></Field>
        <SelectorTerritorio territorio={territorio} inicial={{ region: p?.Region ?? null, ciudad: p?.Ciudad ?? null, comuna: p?.Comuna ?? null }} />
        <Field label="RUT representante legal"><input name="rutRepresentante" defaultValue={p?.RutRepresentanteLegal ?? ""} className="input" autoComplete="off" /></Field>
        <Field label="Nombre representante legal" className="fld-2"><input name="nombreRepresentante" defaultValue={p?.NombreRepresentanteLegal ?? ""} className="input" /></Field>
        <Field label="Teléfono"><input name="telefono" type="tel" defaultValue={p?.Telefono ?? ""} className="input" inputMode="tel" /></Field>
        <CampoCorreo className="fld-2" defaultValue={p?.Correo} />
        <EstadoSelect valor={p?.IdEstado} />
      </div>
      <div className="form-actions">
        <button disabled={pending} className="btn btn-primary">{p ? "Guardar cambios" : "Crear proveedor"}</button>
        <Estado s={state} />
      </div>
    </form>
  );
}

export type Sucursal = {
  IdSucursal: number; Region: string | null; Comuna: string | null; Ciudad: string | null; Direccion: string | null;
  Telefono: string | null; Correo: string | null; EncargadoSucursal: string | null; IdEstado: number;
};

export function FormSucursal({ idProveedor, s, territorio, despuesDeGuardar }: {
  idProveedor: number; s?: Sucursal; territorio: Territorio;
  /** Al guardar bien se va a esta ruta (la edición del proveedor, con el aviso). */
  despuesDeGuardar?: string;
}) {
  const router = useRouter();
  const { state, pending, onSubmit } = useAccion(guardarSucursal, {
    limpiarSiOk: !s,
    onOk: () => { if (despuesDeGuardar) router.push(despuesDeGuardar); },
  });
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="idProveedor" value={idProveedor} />
      {s && <input type="hidden" name="idSucursal" value={s.IdSucursal} />}
      <div className="form-grid form-grid-4">
        <Field label="Dirección" className="fld-2"><input name="direccion" defaultValue={s?.Direccion ?? ""} required className="input" /></Field>
        <SelectorTerritorio territorio={territorio} inicial={{ region: s?.Region ?? null, ciudad: s?.Ciudad ?? null, comuna: s?.Comuna ?? null }} />
        <Field label="Teléfono"><input name="telefono" type="tel" defaultValue={s?.Telefono ?? ""} className="input" inputMode="tel" /></Field>
        <CampoCorreo defaultValue={s?.Correo} />
        <Field label="Encargado"><input name="encargado" defaultValue={s?.EncargadoSucursal ?? ""} className="input" /></Field>
        <EstadoSelect valor={s?.IdEstado} />
      </div>
      <div className="form-actions">
        <button disabled={pending} className="btn btn-primary">{s ? "Guardar cambios" : "Agregar sucursal"}</button>
        <Estado s={state} />
      </div>
    </form>
  );
}

export type Vendedor = {
  IdVendedor: number; Rut: string; Nombres: string; Apellidos: string; Telefono: string | null; Correo: string | null; IdEstado: number;
};

export function FormVendedor({ idProveedor, v, despuesDeGuardar }: {
  idProveedor: number; v?: Vendedor;
  /** Al guardar bien se va a esta ruta (la edición del proveedor, con el aviso). */
  despuesDeGuardar?: string;
}) {
  const router = useRouter();
  const { state, pending, onSubmit } = useAccion(guardarVendedor, {
    limpiarSiOk: !v,
    onOk: () => { if (despuesDeGuardar) router.push(despuesDeGuardar); },
  });
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="idProveedor" value={idProveedor} />
      {v && <input type="hidden" name="idVendedor" value={v.IdVendedor} />}
      <div className="form-grid form-grid-4">
        <Field label="RUT"><input name="rut" defaultValue={v?.Rut} required className="input" autoComplete="off" /></Field>
        <Field label="Nombres"><input name="nombres" defaultValue={v?.Nombres} required className="input" /></Field>
        <Field label="Apellidos"><input name="apellidos" defaultValue={v?.Apellidos} required className="input" /></Field>
        <Field label="Teléfono"><input name="telefono" type="tel" defaultValue={v?.Telefono ?? ""} className="input" inputMode="tel" /></Field>
        <CampoCorreo className="fld-2" defaultValue={v?.Correo} />
        <EstadoSelect valor={v?.IdEstado} />
      </div>
      <div className="form-actions">
        <button disabled={pending} className="btn btn-primary">{v ? "Guardar cambios" : "Agregar vendedor"}</button>
        <Estado s={state} />
      </div>
    </form>
  );
}
