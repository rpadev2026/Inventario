"use client";
import Link from "next/link";
import { useAccion } from "@/lib/use-accion";
import Field from "@/components/app/field";
import { guardarBodega } from "./actions";

type Props = {
  b?: { IdBodega: number; NombreBodega: string; IdEstado: number; EsCentral: boolean };
  /** Se llama al guardar bien (el padre cierra el formulario o vuelve al listado). */
  onGuardado?: () => void;
  /** Si se indica, muestra «Cancelar» hacia esa ruta. */
  cancelarHref?: string;
};

export default function FormBodega({ b, onGuardado, cancelarHref }: Props) {
  const { state, pending, onSubmit } = useAccion(guardarBodega, { limpiarSiOk: !b, onOk: () => onGuardado?.() });
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end">
      {b && <input type="hidden" name="idBodega" value={b.IdBodega} />}
      <Field label={b ? `Nombre${b.EsCentral ? " (bodega central)" : ""}` : "Nombre de la bodega"}>
        <input name="nombre" defaultValue={b?.NombreBodega} required className="input" />
      </Field>
      <Field label="Estado">
        <select name="estado" defaultValue={b?.IdEstado ?? 1} disabled={b?.EsCentral} className="input">
          <option value={1}>Vigente</option><option value={0}>No vigente</option>
        </select>
      </Field>
      <div className="form-actions">
        <button disabled={pending} className="btn btn-primary">{b ? "Guardar cambios" : "Crear bodega"}</button>
        {cancelarHref && <Link href={cancelarHref} className="btn btn-secondary">Cancelar</Link>}
      </div>
      {state?.error && <span role="alert" className="msg msg-error sm:col-span-3">{state.error}</span>}
    </form>
  );
}
