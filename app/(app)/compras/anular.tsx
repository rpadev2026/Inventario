"use client";
import { useActionState, useState } from "react";
import { anularFactura } from "./actions";

export default function AnularFactura({ id, folio }: { id: number; folio: number }) {
  const [abierto, setAbierto] = useState(false);
  const [state, action, pending] = useActionState(anularFactura, undefined);
  if (!abierto) return <button onClick={() => setAbierto(true)} className="link link-sm">Anular</button>;
  return (
    <form action={action} className="grid gap-2 min-w-56">
      <input type="hidden" name="id" value={id} />
      <input name="motivo" required minLength={5} maxLength={300} aria-label={`Motivo de anulación del folio ${folio}`} placeholder="Motivo de anulación" className="input input-sm" />
      <div className="flex gap-2">
        <button disabled={pending} className="link link-sm link-danger">Confirmar anulación</button>
        <button type="button" onClick={() => setAbierto(false)} className="link link-sm">Cancelar</button>
      </div>
      {state?.error && <span role="alert" className="msg msg-error">{state.error}</span>}
    </form>
  );
}
