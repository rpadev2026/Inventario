"use client";
import { useActionState } from "react";
import { cambiarClave } from "./actions";
import Field from "@/components/app/field";
import CampoClave from "@/components/app/campo-clave";

export default function CambiarClave() {
  const [state, action, pending] = useActionState(cambiarClave, undefined);
  return (
    <main className="auth-wrap">
      <form action={action} className="card card-lg auth-card grid gap-5">
        <div>
          <h1 className="page-title">Cambiar clave</h1>
          <p className="text-muted text-sm">La nueva clave no puede repetir sus últimas 5 claves.</p>
        </div>
        <Field label="Clave actual"><input name="actual" type="password" required autoComplete="current-password" className="input" /></Field>
        <CampoClave label="Nueva clave" name="nueva" />
        <Field label="Confirmar nueva clave"><input name="conf" type="password" required autoComplete="new-password" className="input" /></Field>
        {state?.error && <p role="alert" className="alert alert-error">{state.error}</p>}
        <button disabled={pending} className="btn btn-primary btn-block">Guardar clave</button>
      </form>
    </main>
  );
}
