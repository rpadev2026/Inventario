"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccion } from "@/lib/use-accion";
import Field from "@/components/app/field";
import { rechazarSolicitud } from "./actions";

/** Rechazo con motivo obligatorio (1 a 100 caracteres): el solicitante lo verá en su bandeja, en el aviso y en el detalle. */
export default function FormRechazar({ id }: { id: number }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const { state, pending, onSubmit } = useAccion(rechazarSolicitud, { onOk: () => router.refresh() });
  return (
    <form onSubmit={onSubmit} className="card grid gap-3">
      <input type="hidden" name="id" value={id} />
      <Field label="Motivo del rechazo" hint="Obligatorio. Máximo 100 caracteres; el solicitante lo verá.">
        <input name="motivo" required maxLength={100} className="input" autoComplete="off" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Field>
      <p className="text-sm text-muted" aria-live="polite">{`${motivo.length}/100`}</p>
      <div className="form-actions">
        <button disabled={pending || motivo.trim() === ""} className="btn btn-danger">{pending ? "Rechazando…" : "Rechazar solicitud"}</button>
        {state?.error && <span role="alert" className="msg msg-error">{state.error}</span>}
      </div>
    </form>
  );
}
