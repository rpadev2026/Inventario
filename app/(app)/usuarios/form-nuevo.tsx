"use client";
import { useRouter } from "next/navigation";
import { useAccion } from "@/lib/use-accion";
import Field from "@/components/app/field";
import CampoCorreo from "@/components/app/campo-correo";
import { crearUsuario } from "./actions";

type Props = {
  roles: { IdRol: number; NombreRol: string }[];
  /** Al crear bien se va a esta ruta (el listado, con el aviso). */
  despuesDeGuardar?: string;
};

export default function FormNuevoUsuario({ roles, despuesDeGuardar }: Props) {
  const router = useRouter();
  const { state, pending, onSubmit } = useAccion(crearUsuario, { onOk: () => { if (despuesDeGuardar) router.push(despuesDeGuardar); } });
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="form-grid form-grid-3">
        <Field label="RUT" hint="Ej: 12345678-5"><input name="rut" required className="input" autoComplete="off" /></Field>
        <Field label="Nombres"><input name="nombres" required className="input" /></Field>
        <Field label="Apellidos"><input name="apellidos" required className="input" /></Field>
        <CampoCorreo required />
        <Field label="Clave temporal" hint="Mínimo 12 caracteres; deberá cambiarla al ingresar">
          <input name="password" type="password" required autoComplete="new-password" className="input" />
        </Field>
        <Field label="Rol">
          <select name="idRol" required className="input">{roles.map((r) => <option key={r.IdRol} value={r.IdRol}>{r.NombreRol}</option>)}</select>
        </Field>
      </div>
      <div className="form-actions">
        <button disabled={pending} className="btn btn-primary">{pending ? "Creando…" : "Crear usuario"}</button>
        {state?.error && <span role="alert" className="msg msg-error">{state.error}</span>}
      </div>
    </form>
  );
}
