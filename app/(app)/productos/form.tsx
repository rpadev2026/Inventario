"use client";
import { useRouter } from "next/navigation";
import { useAccion } from "@/lib/use-accion";
import { rutaVolverSegura } from "@/lib/volver";
import Field from "@/components/app/field";
import { guardarProducto } from "./actions";
import { opcionesCatalogo, type ItemCatalogo } from "@/lib/catalogo-opciones";

export type Producto = {
  CodigoProducto: string; NombreProducto: string; UnidadMedida: string; Formato: string;
  StockMinimo: number; StockCritico: number; IdEstado: number;
};

type Props = {
  p?: Producto; unidades: ItemCatalogo[]; formatos: ItemCatalogo[];
  /** Ruta de origen (p. ej. la factura): al crear, vuelve ahí con el producto elegido. */
  volver?: string;
  /** Si no hay ruta de origen, al guardar bien se va a esta ruta (el listado, con el aviso). */
  despuesDeGuardar?: string;
};

export default function FormProducto({ p, unidades, formatos, volver, despuesDeGuardar }: Props) {
  const router = useRouter();
  const { state, pending, onSubmit } = useAccion(guardarProducto, {
    limpiarSiOk: !p,
    onOk: (r) => {
      // Solo al crear: vuelve a la pantalla de origen (ruta interna segura) con el nuevo producto elegido.
      const ruta = rutaVolverSegura(volver);
      if (!p && r.codigo && ruta) router.push(`${ruta}?producto=${encodeURIComponent(r.codigo)}`);
      else if (despuesDeGuardar) router.push(despuesDeGuardar);
    },
  });
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="modo" value={p ? "editar" : "crear"} />
      <div className="form-grid form-grid-4">
        <Field label="Código"><input name="codigo" defaultValue={p?.CodigoProducto} readOnly={!!p} required className="input" /></Field>
        <Field label="Nombre" className="fld-3"><input name="nombre" defaultValue={p?.NombreProducto} required className="input" /></Field>
        <Field label="Unidad de medida"><select name="unidad" defaultValue={p?.UnidadMedida} className="input">{opcionesCatalogo(unidades, p?.UnidadMedida).map((o) => <option key={o.codigo} value={o.codigo}>{o.etiqueta}</option>)}</select></Field>
        <Field label="Formato"><select name="formato" defaultValue={p?.Formato} className="input">{opcionesCatalogo(formatos, p?.Formato).map((o) => <option key={o.codigo} value={o.codigo}>{o.etiqueta}</option>)}</select></Field>
        <Field label="Stock mínimo"><input name="stockMinimo" type="number" step="0.001" min="0" inputMode="decimal" defaultValue={p?.StockMinimo ?? 0} className="input" /></Field>
        <Field label="Stock crítico" hint="No puede superar al mínimo"><input name="stockCritico" type="number" step="0.001" min="0" inputMode="decimal" defaultValue={p?.StockCritico ?? 0} className="input" /></Field>
        <Field label="Estado"><select name="estado" defaultValue={p?.IdEstado ?? 1} className="input"><option value={1}>Vigente</option><option value={0}>No vigente</option></select></Field>
      </div>
      <div className="form-actions">
        <button disabled={pending} className="btn btn-primary">{p ? "Guardar cambios" : "Crear producto"}</button>
        {state?.error && <span role="alert" className="msg msg-error">{state.error}</span>}
        {state?.ok && <span role="status" className="msg msg-ok">Guardado</span>}
      </div>
    </form>
  );
}
