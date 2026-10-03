"use client";
import { useAccion } from "@/lib/use-accion";
import Field from "@/components/app/field";
import CampoCorreo from "@/components/app/campo-correo";
import { crearUsuario } from "./actions";

export default function FormNuevoUsuario({ roles }: { roles: { IdRol: number; NombreRol: string }[] }) {
  const { state, pending, onSubmit } = useAccion(crearUsuario);
  return (
    <form onSubmit={onSubmit} className="card grid gap-4">
      <h2 className="section-title">Nuevo usuario</h2>
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
        {state?.ok && <span role="status" className="msg msg-ok">Usuario creado. Deberá cambiar su clave al ingresar.</span>}
      </div>
    </form>
  );
}
