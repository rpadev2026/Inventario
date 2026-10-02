"use client";
import { useRouter } from "next/navigation";
import { useAccion } from "@/lib/use-accion";
import { rutaVolverSegura } from "@/lib/volver";
import Field from "@/components/app/field";
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

export function FormProveedor({ p, volver }: { p?: Proveedor; volver?: string }) {
  const router = useRouter();
  const { state, pending, onSubmit } = useAccion(guardarProveedor, {
    limpiarSiOk: !p,
    onOk: (r) => {
      // Solo al crear: vuelve a la pantalla de origen (ruta interna segura) con el nuevo proveedor elegido.
      const ruta = rutaVolverSegura(volver);
      if (!p && r.id && ruta) router.push(`${ruta}?proveedor=${encodeURIComponent(String(r.id))}`);
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
        <Field label="Región"><input name="region" defaultValue={p?.Region ?? ""} className="input" /></Field>
        <Field label="Comuna"><input name="comuna" defaultValue={p?.Comuna ?? ""} className="input" /></Field>
        <Field label="Ciudad"><input name="ciudad" defaultValue={p?.Ciudad ?? ""} className="input" /></Field>
        <Field label="RUT representante legal"><input name="rutRepresentante" defaultValue={p?.RutRepresentanteLegal ?? ""} className="input" autoComplete="off" /></Field>
        <Field label="Nombre representante legal" className="fld-2"><input name="nombreRepresentante" defaultValue={p?.NombreRepresentanteLegal ?? ""} className="input" /></Field>
        <Field label="Teléfono"><input name="telefono" type="tel" defaultValue={p?.Telefono ?? ""} className="input" inputMode="tel" /></Field>
        <Field label="Correo" className="fld-2"><input name="correo" type="email" defaultValue={p?.Correo ?? ""} className="input" inputMode="email" /></Field>
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

export function FormSucursal({ idProveedor, s }: { idProveedor: number; s?: Sucursal }) {
  const { state, pending, onSubmit } = useAccion(guardarSucursal, { limpiarSiOk: !s });
  return (
    <form onSubmit={onSubmit} className="grid gap-4 divider-t pt-4">
      <input type="hidden" name="idProveedor" value={idProveedor} />
      {s && <input type="hidden" name="idSucursal" value={s.IdSucursal} />}
      <div className="form-grid form-grid-4">
        <Field label="Dirección" className="fld-2"><input name="direccion" defaultValue={s?.Direccion ?? ""} required className="input" /></Field>
        <Field label="Región"><input name="region" defaultValue={s?.Region ?? ""} className="input" /></Field>
        <Field label="Comuna"><input name="comuna" defaultValue={s?.Comuna ?? ""} className="input" /></Field>
        <Field label="Ciudad"><input name="ciudad" defaultValue={s?.Ciudad ?? ""} className="input" /></Field>
        <Field label="Teléfono"><input name="telefono" type="tel" defaultValue={s?.Telefono ?? ""} className="input" inputMode="tel" /></Field>
        <Field label="Correo"><input name="correo" type="email" defaultValue={s?.Correo ?? ""} className="input" inputMode="email" /></Field>
        <Field label="Encargado"><input name="encargado" defaultValue={s?.EncargadoSucursal ?? ""} className="input" /></Field>
        <EstadoSelect valor={s?.IdEstado} />
      </div>
      <div className="form-actions">
        <button disabled={pending} className={`btn ${s ? "btn-secondary" : "btn-primary"}`}>{s ? "Guardar sucursal" : "Agregar sucursal"}</button>
        <Estado s={state} />
      </div>
    </form>
  );
}

export type Vendedor = {
  IdVendedor: number; Rut: string; Nombres: string; Apellidos: string; Telefono: string | null; Correo: string | null; IdEstado: number;
};

export function FormVendedor({ idProveedor, v }: { idProveedor: number; v?: Vendedor }) {
  const { state, pending, onSubmit } = useAccion(guardarVendedor, { limpiarSiOk: !v });
  return (
    <form onSubmit={onSubmit} className="grid gap-4 divider-t pt-4">
      <input type="hidden" name="idProveedor" value={idProveedor} />
      {v && <input type="hidden" name="idVendedor" value={v.IdVendedor} />}
      <div className="form-grid form-grid-4">
        <Field label="RUT"><input name="rut" defaultValue={v?.Rut} required className="input" autoComplete="off" /></Field>
        <Field label="Nombres"><input name="nombres" defaultValue={v?.Nombres} required className="input" /></Field>
        <Field label="Apellidos"><input name="apellidos" defaultValue={v?.Apellidos} required className="input" /></Field>
        <Field label="Teléfono"><input name="telefono" type="tel" defaultValue={v?.Telefono ?? ""} className="input" inputMode="tel" /></Field>
        <Field label="Correo" className="fld-2"><input name="correo" type="email" defaultValue={v?.Correo ?? ""} className="input" inputMode="email" /></Field>
        <EstadoSelect valor={v?.IdEstado} />
      </div>
      <div className="form-actions">
        <button disabled={pending} className={`btn ${v ? "btn-secondary" : "btn-primary"}`}>{v ? "Guardar vendedor" : "Agregar vendedor"}</button>
        <Estado s={state} />
      </div>
    </form>
  );
}
