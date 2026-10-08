"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccion } from "@/lib/use-accion";
import { rutaVolverSegura } from "@/lib/volver";
import Field from "@/components/app/field";
import { guardarProducto } from "./actions";
import { opcionesCatalogo, type ItemCatalogo } from "@/lib/catalogo-opciones";
import { unidadesBase, unidadesDeFamilia, type UnidadInfo } from "@/lib/unidades";

export type Producto = {
  IdProducto: number; Codigo: string | null; Nombre: string; UnidadBase: string; Formato: string;
  CostoUnitarioBase: number | null; StockMinimo: number; StockCritico: number; IdEstado: number;
};

type Props = {
  p?: Producto; unidades: UnidadInfo[]; formatos: ItemCatalogo[];
  /** El producto ya tiene stock o facturas: su unidad base no se puede cambiar. */
  unidadBaseBloqueada?: boolean;
  /** En cuántas recetas se usa: si se desactiva, esas recetas no podrán guardarse hasta cambiar la línea. */
  enRecetas?: number;
  /** Ruta de origen (p. ej. la factura): al crear, vuelve ahí con el producto elegido. */
  volver?: string;
  /** Si no hay ruta de origen, al guardar bien se va a esta ruta (el listado, con el aviso). */
  despuesDeGuardar?: string;
};

export default function FormProducto({ p, unidades, formatos, unidadBaseBloqueada, enRecetas = 0, volver, despuesDeGuardar }: Props) {
  const router = useRouter();
  const bases = unidadesBase(unidades);
  const [base, setBase] = useState(p?.UnidadBase ?? bases[0]?.Codigo ?? "");
  const familia = unidadesDeFamilia(unidades, base, base); // incluye la base aunque esté no vigente
  const { state, pending, onSubmit } = useAccion(guardarProducto, {
    limpiarSiOk: !p,
    onOk: (r) => {
      // Solo al crear: vuelve a la pantalla de origen (ruta interna segura) con el nuevo producto elegido.
      const ruta = rutaVolverSegura(volver);
      if (!p && r.id && ruta) router.push(`${ruta}?producto=${r.id}`);
      else if (despuesDeGuardar) router.push(despuesDeGuardar);
    },
  });
  // Opciones de la unidad base: las unidades base vigentes (y la actual del producto aunque esté inactiva).
  const opcionesBase = bases.some((u) => u.Codigo === p?.UnidadBase) || !p ? bases : [...bases, ...unidades.filter((u) => u.Codigo === p.UnidadBase)];

  const campoStock = (nombre: "stockMinimo" | "stockCritico", unidad: "unidadMinimo" | "unidadCritico", etiqueta: string, valor: number | undefined, ayuda?: string) => (
    <Field label={etiqueta} hint={ayuda}>
      <div className="flex gap-2">
        <input name={nombre} type="number" step="0.001" min="0" inputMode="decimal" defaultValue={valor ?? 0} className="input" />
        <select key={base} name={unidad} defaultValue={base} aria-label={`Unidad de ${etiqueta.toLowerCase()}`} className="input">
          {familia.map((u) => <option key={u.Codigo} value={u.Codigo}>{u.Nombre}</option>)}
        </select>
      </div>
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="modo" value={p ? "editar" : "crear"} />
      {p && <input type="hidden" name="id" value={p.IdProducto} />}
      <div className="form-grid form-grid-4">
        <Field label="Código" hint="Opcional"><input name="codigo" defaultValue={p?.Codigo ?? ""} maxLength={40} className="input" /></Field>
        <Field label="Nombre" className="fld-3"><input name="nombre" defaultValue={p?.Nombre} required className="input" /></Field>
        <Field label="Unidad base" hint={unidadBaseBloqueada ? "No se puede cambiar: el producto ya tiene stock o facturas" : "Unidad en que se lleva su stock y su costo"}>
          <select name="unidadBase" value={base} onChange={(e) => setBase(e.target.value)} disabled={unidadBaseBloqueada} required className="input">
            {opcionesBase.map((u) => <option key={u.Codigo} value={u.Codigo}>{u.Nombre}</option>)}
          </select>
          {unidadBaseBloqueada && <input type="hidden" name="unidadBase" value={base} />}
        </Field>
        <Field label="Formato"><select name="formato" defaultValue={p?.Formato} className="input">{opcionesCatalogo(formatos, p?.Formato).map((o) => <option key={o.codigo} value={o.codigo}>{o.etiqueta}</option>)}</select></Field>
        {campoStock("stockMinimo", "unidadMinimo", "Stock mínimo", p?.StockMinimo)}
        {campoStock("stockCritico", "unidadCritico", "Stock crítico", p?.StockCritico, "No puede superar al mínimo")}
        <Field label="Estado" hint={enRecetas > 0 ? `Se usa en ${enRecetas} ${enRecetas === 1 ? "receta" : "recetas"}: si lo desactiva, no podrán guardarse hasta cambiar esa línea` : undefined}><select name="estado" defaultValue={p?.IdEstado ?? 1} className="input"><option value={1}>Vigente</option><option value={0}>No vigente</option></select></Field>
      </div>
      <div className="form-actions">
        <button disabled={pending} className="btn btn-primary">{p ? "Guardar cambios" : "Crear producto"}</button>
        {state?.error && <span role="alert" className="msg msg-error">{state.error}</span>}
        {state?.ok && <span role="status" className="msg msg-ok">Guardado</span>}
      </div>
    </form>
  );
}
