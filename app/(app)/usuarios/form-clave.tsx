"use client";
import { useAccion } from "@/lib/use-accion";
import Field from "@/components/app/field";
import { resetearClave } from "./actions";

/** El Administrador fija una clave temporal; el usuario deberá cambiarla al ingresar. */
export default function FormClaveUsuario({ id }: { id: number }) {
  const { state, pending, onSubmit } = useAccion(resetearClave);
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="id" value={id} />
      <div className="form-grid form-grid-3">
        <Field label="Nueva clave temporal" hint="Mínimo 12 caracteres; no puede repetir sus últimas 5 claves">
          <input name="password" type="password" required autoComplete="new-password" className="input" />
        </Field>
      </div>
      <div className="form-actions">
        <button disabled={pending} className="btn btn-primary">{pending ? "Guardando…" : "Cambiar clave"}</button>
        {state?.error && <span role="alert" className="msg msg-error">{state.error}</span>}
        {state?.ok && <span role="status" className="msg">Clave cambiada. El usuario deberá cambiarla al ingresar.</span>}
      </div>
    </form>
  );
}
