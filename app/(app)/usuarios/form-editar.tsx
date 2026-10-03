"use client";
import { useRouter } from "next/navigation";
import { useAccion } from "@/lib/use-accion";
import Field from "@/components/app/field";
import CampoCorreo from "@/components/app/campo-correo";
import { guardarUsuario } from "./actions";

export type UsuarioEditable = { IdUsuario: number; Rut: string; Nombres: string; Apellidos: string; Correo: string; IdEstado: number };

/** Datos de un usuario. El RUT no se modifica; nadie puede desactivar su propio usuario. */
export default function FormEditarUsuario({ u, esPropio, despuesDeGuardar }: { u: UsuarioEditable; esPropio: boolean; despuesDeGuardar: string }) {
  const router = useRouter();
  const { state, pending, onSubmit } = useAccion(guardarUsuario, { limpiarSiOk: false, onOk: () => router.push(despuesDeGuardar) });
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="id" value={u.IdUsuario} />
      {/* Un select deshabilitado no se envía: el propio usuario siempre queda vigente. */}
      {esPropio && <input type="hidden" name="estado" value={1} />}
      <div className="form-grid form-grid-3">
        <Field label="RUT" hint="No se puede cambiar"><input value={u.Rut} readOnly className="input" /></Field>
        <Field label="Nombres"><input name="nombres" defaultValue={u.Nombres} required className="input" /></Field>
        <Field label="Apellidos"><input name="apellidos" defaultValue={u.Apellidos} required className="input" /></Field>
        <CampoCorreo className="fld-2" defaultValue={u.Correo} required />
        <Field label="Estado" hint={esPropio ? "No puede desactivar su propio usuario" : undefined}>
          <select name={esPropio ? undefined : "estado"} defaultValue={u.IdEstado} disabled={esPropio} className="input">
            <option value={1}>Vigente</option><option value={0}>No vigente</option>
          </select>
        </Field>
      </div>
      <div className="form-actions">
        <button disabled={pending} className="btn btn-primary">Guardar cambios</button>
        {state?.error && <span role="alert" className="msg msg-error">{state.error}</span>}
      </div>
    </form>
  );
}
