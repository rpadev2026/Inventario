"use client";
import { useRouter } from "next/navigation";
import { useAccion } from "@/lib/use-accion";
import Field from "@/components/app/field";
import CampoCorreo from "@/components/app/campo-correo";
import CampoClave from "@/components/app/campo-clave";
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
      <p className="text-sm text-muted">Todos los campos son obligatorios.</p>
      <div className="form-grid form-grid-3">
        <Field label="RUT" hint="Sin puntos, con guion y dígito verificador. Ej: 12345678-5"><input name="rut" required className="input" autoComplete="off" /></Field>
        <Field label="Nombres" hint="Hasta 100 caracteres"><input name="nombres" required maxLength={100} className="input" /></Field>
        <Field label="Apellidos" hint="Hasta 100 caracteres"><input name="apellidos" required maxLength={100} className="input" /></Field>
        <CampoCorreo required ayuda="Con formato nombre@dominio.cl; debe ser único" />
        <CampoClave label="Clave temporal" name="password" hint="El usuario deberá cambiarla al ingresar" className="fld-2" />
        <Field label="Rol" hint="Define a qué módulos accede">
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
