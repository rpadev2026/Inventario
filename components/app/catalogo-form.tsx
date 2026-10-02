"use client";
import { useAccion } from "@/lib/use-accion";
import Field from "@/components/app/field";
import type { CatalogoCfg } from "@/lib/services/catalogo";

export type ItemCatalogo = { Codigo: string; Nombre: string; IdEstado: number; [padre: string]: string | number };
export type OpcionPadre = { codigo: string; etiqueta: string };
type Accion = (prev: unknown, fd: FormData) => Promise<{ error?: string; ok?: boolean }>;

export function FormCatalogo({ item, accion, cfg, opcionesPadre }: {
  item?: ItemCatalogo; accion: Accion; cfg?: CatalogoCfg; opcionesPadre?: OpcionPadre[];
}) {
  const padre = cfg?.padre;
  const padreActual = padre && item ? String(item[padre.columna] ?? "") : "";
  const { state, pending, onSubmit } = useAccion(accion, { limpiarSiOk: !item });
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="modo" value={item ? "editar" : "crear"} />
      <div className={padre ? "form-grid form-grid-2" : "form-grid form-grid-3"}>
        {padre && (
          <Field label={padre.etiqueta} hint={item ? "No se puede cambiar" : undefined}>
            <select name="padre" defaultValue={padreActual} disabled={!!item} required={!item} className="input">
              {!item && <option value="">Seleccione…</option>}
              {(opcionesPadre ?? []).map((o) => <option key={o.codigo} value={o.codigo}>{o.etiqueta}</option>)}
            </select>
          </Field>
        )}
        <Field label="Código" hint={item ? "No se puede cambiar" : (cfg?.ayudaCodigo ?? "Letras, números y _ (se guarda en mayúsculas)")}>
          <input
            name="codigo" defaultValue={item?.Codigo} readOnly={!!item} required maxLength={30} className="input"
            inputMode={cfg?.patronCodigo ? "numeric" : undefined}
          />
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
