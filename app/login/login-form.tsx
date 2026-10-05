"use client";
import { useActionState } from "react";
import { login } from "./actions";
import Field from "@/components/app/field";
import CampoCorreo from "@/components/app/campo-correo";
import Icon from "@/components/app/icon";
import FondoShader from "@/components/app/fondo-shader";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className="auth-wrap auth-wrap-fondo">
      <FondoShader />
      <form action={action} className="card card-lg auth-card grid gap-5">
        <div className="grid gap-3">
          <span className="brand-mark" style={{ width: "2.5rem", height: "2.5rem" }}><Icon name="warehouse" size={22} /></span>
          <div>
            <h1 className="page-title">Inventario del Restaurant</h1>
            <p className="text-muted text-sm">Ingresa con tu correo y clave para continuar.</p>
          </div>
        </div>
        <CampoCorreo required autoComplete="username" marcado={!!state?.error} />
        <Field label="Clave">
          <input name="password" type="password" required autoComplete="current-password" className="input" aria-invalid={!!state?.error} />
        </Field>
        {state?.error && <p role="alert" className="alert alert-error">{state.error}</p>}
        <button disabled={pending} className="btn btn-primary btn-block">
          {pending ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
