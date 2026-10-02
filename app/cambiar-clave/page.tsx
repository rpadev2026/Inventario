"use client";
import { useActionState } from "react";
import { cambiarClave } from "./actions";
import Field from "@/components/app/field";

export default function CambiarClave() {
  const [state, action, pending] = useActionState(cambiarClave, undefined);
  return (
    <main className="auth-wrap">
      <form action={action} className="card card-lg auth-card grid gap-5">
        <div>
          <h1 className="page-title">Cambiar clave</h1>
          <p className="text-muted text-sm">Mínimo 12 caracteres con mayúscula, minúscula, número y símbolo.</p>
        </div>
        <Field label="Clave actual"><input name="actual" type="password" required autoComplete="current-password" className="input" /></Field>
        <Field label="Nueva clave"><input name="nueva" type="password" required autoComplete="new-password" className="input" /></Field>
        <Field label="Confirmar nueva clave"><input name="conf" type="password" required autoComplete="new-password" className="input" /></Field>
        {state?.error && <p role="alert" className="alert alert-error">{state.error}</p>}
        <button disabled={pending} className="btn btn-primary btn-block">Guardar clave</button>
      </form>
    </main>
  );
}
