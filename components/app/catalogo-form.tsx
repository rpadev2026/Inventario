"use client";
import { useAccion } from "@/lib/use-accion";
import Field from "@/components/app/field";

export type ItemCatalogo = { Codigo: string; Nombre: string; IdEstado: number };
type Accion = (prev: unknown, fd: FormData) => Promise<{ error?: string; ok?: boolean }>;

export function FormCatalogo({ item, accion }: { item?: ItemCatalogo; accion: Accion }) {
  const { state, pending, onSubmit } = useAccion(accion, { limpiarSiOk: !item });
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="modo" value={item ? "editar" : "crear"} />
      <div className="form-grid form-grid-3">
        <Field label="Código" hint={item ? "No se puede cambiar" : "Letras, números y _ (se guarda en mayúsculas)"}>
          <input name="codigo" defaultValue={item?.Codigo} readOnly={!!item} required maxLength={30} className="input" />
        </Field>
        <Field label="Nombre">
          <input name="nombre" defaultValue={item?.Nombre} required maxLength={80} className="input" />
        </Field>
        <Field label="Estado">
          <select name="estado" defaultValue={item?.IdEstado ?? 1} className="input">
            <option value={1}>Vigente</option>
            <option value={0}>No vigente</option>
          </select>
        </Field>
      </div>
      <div className="form-actions">
        <button disabled={pending} className="btn btn-primary">{item ? "Guardar cambios" : "Crear"}</button>
        {state?.error && <span role="alert" className="msg msg-error">{state.error}</span>}
        {state?.ok && <span role="status" className="msg msg-ok">Guardado</span>}
      </div>
    </form>
  );
}
