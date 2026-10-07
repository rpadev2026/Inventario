"use client";
import { useRouter } from "next/navigation";
import { useAccion } from "@/lib/use-accion";
import Field from "@/components/app/field";
import type { PropsFormCatalogo } from "@/lib/services/catalogo";

export type ItemCatalogo = { Codigo: string; Nombre: string; IdEstado: number; [padre: string]: string | number };
export type OpcionPadre = { codigo: string; etiqueta: string; vigente: boolean };
type Accion = (prev: unknown, fd: FormData) => Promise<{ error?: string; ok?: boolean }>;

export function FormCatalogo({ item, accion, cfg, opcionesPadre, opcionesBase, despuesDeGuardar }: {
  item?: ItemCatalogo; accion: Accion; cfg?: PropsFormCatalogo; opcionesPadre?: OpcionPadre[];
  /** Solo unidades de medida: las unidades que son base (factor 1) y se pueden elegir como unidad base. */
  opcionesBase?: OpcionPadre[];
  /** Al guardar bien se va a esta ruta (el listado, con el aviso). */
  despuesDeGuardar?: string;
}) {
  const router = useRouter();
  const padre = cfg?.padre;
  // Al crear solo se ofrecen padres vigentes; al editar se muestran todos para reflejar el padre real.
  const padres = (opcionesPadre ?? []).filter((o) => item || o.vigente);
  const padreActual = padre && item ? String(item[padre.columna] ?? "") : "";
  // Al crear solo se ofrecen bases vigentes; al editar, todas (menos ella misma, que va como «esta misma unidad»).
  const bases = (opcionesBase ?? []).filter((o) => (item || o.vigente) && o.codigo !== item?.Codigo);
  const baseActual = item && item.UnidadBase !== item.Codigo ? String(item.UnidadBase ?? "") : "";
  const { state, pending, onSubmit } = useAccion(accion, {
    limpiarSiOk: !item,
    onOk: () => { if (despuesDeGuardar) router.push(despuesDeGuardar); },
  });
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="modo" value={item ? "editar" : "crear"} />
      <div className={padre ? "form-grid form-grid-2" : "form-grid form-grid-3"}>
        {padre && (
          <Field label={padre.etiqueta} hint={item ? "No se puede cambiar" : undefined}>
            <select name="padre" defaultValue={padreActual} disabled={!!item} required={!item} className="input">
              {!item && <option value="">Seleccione…</option>}
              {padres.map((o) => <option key={o.codigo} value={o.codigo}>{o.etiqueta}</option>)}
            </select>
          </Field>
        )}
        <Field label="Código" hint={item ? "No se puede cambiar" : (cfg?.ayudaCodigo ?? "Letras, números y _ (se guarda en mayúsculas)")}>
          <input
            name="codigo" defaultValue={item?.Codigo} readOnly={!!item} required maxLength={30} className="input"
            inputMode={cfg?.codigoNumerico ? "numeric" : undefined}
          />
        </Field>
        <Field label="Nombre">
          <input name="nombre" defaultValue={item?.Nombre} required maxLength={80} className="input" />
        </Field>
        {cfg?.base && (
          <>
            <Field label="Unidad base" hint="Unidad a la que se convierte (p. ej. Kilo → Gramos)">
              <select name="unidadBase" defaultValue={baseActual} className="input">
                <option value="">Esta misma unidad (es unidad base)</option>
                {bases.map((o) => <option key={o.codigo} value={o.codigo}>{o.etiqueta}</option>)}
              </select>
            </Field>
            <Field label="Factor" hint="Cuántas unidades base equivale 1 de esta (Kilo = 1000 Gramos). Si es unidad base, 1">
              <input name="factor" defaultValue={item?.Factor ?? 1} inputMode="decimal" required className="input" />
            </Field>
          </>
        )}
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
      </div>
    </form>
  );
}
