"use client";
import { useAccion } from "@/lib/use-accion";
import Field from "@/components/app/field";
import { guardarBodega } from "./actions";

export default function FormBodega({ b }: { b?: { IdBodega: number; NombreBodega: string; IdEstado: number; EsCentral: boolean } }) {
  const { state, pending, onSubmit } = useAccion(guardarBodega, { limpiarSiOk: !b });
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end">
      {b && <input type="hidden" name="idBodega" value={b.IdBodega} />}
      <Field label={b ? `Nombre${b.EsCentral ? " (bodega central)" : ""}` : "Nueva bodega"}>
        <input name="nombre" defaultValue={b?.NombreBodega} required className="input" />
      </Field>
      <Field label="Estado">
        <select name="estado" defaultValue={b?.IdEstado ?? 1} disabled={b?.EsCentral} className="input">
          <option value={1}>Vigente</option><option value={0}>No vigente</option>
        </select>
      </Field>
      <button disabled={pending} className="btn btn-primary">{b ? "Guardar" : "Crear bodega"}</button>
      {state?.error && <span role="alert" className="msg msg-error sm:col-span-3">{state.error}</span>}
    </form>
  );
}
