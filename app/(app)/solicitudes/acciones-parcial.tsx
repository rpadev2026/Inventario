"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAccion } from "@/lib/use-accion";
import Field from "@/components/app/field";
import { cerrarSolicitud, reaprobarSolicitud } from "./actions";

/** Decisión del Administrador sobre una solicitud «Aprobada parcialmente»: confirmarla (sigue el flujo normal) o cerrarla con motivo. */
export default function AccionesParcial({ id, puedeAprobar }: { id: number; puedeAprobar: boolean }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [errorAprobar, setErrorAprobar] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { state, pending: cerrando, onSubmit } = useAccion(cerrarSolicitud, { onOk: () => router.refresh() });
  function aprobar() {
    setErrorAprobar(null);
    start(async () => {
      const r = await reaprobarSolicitud({ id });
      if (r.error) setErrorAprobar(r.error);
      else router.refresh();
    });
  }
  return (
    <div className="card grid gap-4">
      <h2 className="section-title">Decisión del Administrador</h2>
      {puedeAprobar ? (
        <div className="grid gap-2">
          <p className="text-sm text-muted">Al aprobarla pasa a «Aprobada» con las cantidades ya definidas y el solicitante podrá recepcionarla.</p>
          <div><button type="button" onClick={aprobar} disabled={pending} className="btn btn-primary">{pending ? "Aprobando…" : "Aprobar solicitud"}</button></div>
          {errorAprobar && <p role="alert" className="msg msg-error">{errorAprobar}</p>}
        </div>
      ) : (
        <p className="text-sm text-muted">Es su propia solicitud: no puede aprobarla, otro Administrador debe hacerlo. Sí puede cerrarla.</p>
      )}
      <form onSubmit={onSubmit} className="grid gap-3">
        <input type="hidden" name="id" value={id} />
        <Field label="Motivo del cierre" hint="Obligatorio. Máximo 100 caracteres; se informa a los participantes.">
          <input name="motivo" required maxLength={100} className="input" autoComplete="off" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Field>
        <p className="text-sm text-muted">{`${motivo.length}/100`}</p>
        <div className="form-actions">
          <button disabled={cerrando || motivo.trim() === ""} className="btn btn-danger">{cerrando ? "Cerrando…" : "Cerrar solicitud"}</button>
          {state?.error && <span role="alert" className="msg msg-error">{state.error}</span>}
        </div>
      </form>
    </div>
  );
}
