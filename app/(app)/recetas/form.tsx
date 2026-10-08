"use client";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Field from "@/components/app/field";
import Combobox from "@/components/app/combobox";
import Icon from "@/components/app/icon";
import { guardarReceta } from "./actions";
import { etiquetaProducto } from "@/lib/producto-etiqueta";
import { calcularLinea, calcularReceta, type LineaCalculo } from "@/lib/receta-calculo";
import { unidadDeLinea, unidadesDeFamilia, type UnidadInfo } from "@/lib/unidades";
import { filtrarDecimal, parseCantidad, parseDecimal2 } from "@/lib/numeros";

export type RecetaForm = {
  id: number; codigo: string | null; nombre: string; porciones: number;
  rendimientoCantidad: number | null; rendimientoUnidad: string | null; estado: number;
};
export type LineaForm = { tipo: "producto" | "subreceta"; ingrediente: string; cantidad: string; porcion: string; unidad: string; merma: string };
export type ProductoOpcion = { id: number; codigo: string | null; nombre: string; unidadBase: string; costoBase: number | null; noVigente?: boolean };
/** Receta vigente con rendimiento que se puede usar como ingrediente: `costoPorBase` es null si su costo está incompleto. */
export type SubrecetaOpcion = { id: number; nombre: string; rendimientoUnidad: string; costoPorBase: number | null; noVigente?: boolean };

type Props = {
  receta?: RecetaForm; lineas?: LineaForm[]; productos: ProductoOpcion[]; subrecetas: SubrecetaOpcion[];
  unidades: UnidadInfo[]; despuesDeGuardar: string;
};

const lineaVacia = (): LineaForm => ({ tipo: "producto", ingrediente: "", cantidad: "1", porcion: "", unidad: "", merma: "" });
const clp = (n: number) => n.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 4 });

export default function FormReceta({ receta, lineas: lineasIniciales, productos, subrecetas, unidades, despuesDeGuardar }: Props) {
  const router = useRouter();
  const [codigo, setCodigo] = useState(receta?.codigo ?? "");
  const [nombre, setNombre] = useState(receta?.nombre ?? "");
  const [porciones, setPorciones] = useState(receta ? String(receta.porciones) : "1");
  const [rendCant, setRendCant] = useState(receta?.rendimientoCantidad == null ? "" : String(receta.rendimientoCantidad));
  const [rendUnidad, setRendUnidad] = useState(receta?.rendimientoUnidad ?? "");
  const [estado, setEstado] = useState(String(receta?.estado ?? 1));
  const [lineas, setLineas] = useState<LineaForm[]>(lineasIniciales?.length ? lineasIniciales : [lineaVacia()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const opcionesProducto = useMemo(
    () => productos.map((p) => ({ valor: String(p.id), etiqueta: etiquetaProducto(p.codigo, p.nombre) + (p.noVigente ? " (no vigente)" : ""), busqueda: `${p.codigo ?? ""} ${p.nombre}` })), [productos]);
  const opcionesSub = useMemo(() => subrecetas.map((s) => ({ valor: String(s.id), etiqueta: s.nombre + (s.noVigente ? " (no vigente)" : ""), busqueda: s.nombre })), [subrecetas]);
  const unidadesRendimiento = unidades.filter((u) => u.IdEstado === 1 || u.Codigo === rendUnidad);

  const setLinea = (i: number, cambio: Partial<LineaForm>) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...cambio } : l)));
  /** Unidad base de la familia del ingrediente de la línea ("" si aún no se elige). */
  const familiaDe = (l: LineaForm): string => {
    if (l.tipo === "producto") return productos.find((p) => String(p.id) === l.ingrediente)?.unidadBase ?? "";
    const s = subrecetas.find((x) => String(x.id) === l.ingrediente);
    return s ? unidades.find((u) => u.Codigo === s.rendimientoUnidad)?.UnidadBase ?? "" : "";
  };
  const unidadDe = (l: LineaForm) => unidadDeLinea(unidades, familiaDe(l), l.unidad);
  const costoBaseDe = (l: LineaForm): number | null =>
    l.tipo === "producto"
      ? productos.find((p) => String(p.id) === l.ingrediente)?.costoBase ?? null
      : subrecetas.find((s) => String(s.id) === l.ingrediente)?.costoPorBase ?? null;

  // Vista previa con la misma fórmula del servidor (lib/receta-calculo.ts); una línea incompleta cuenta como «sin costo».
  const entradas = lineas.map((l): LineaCalculo | null => {
    const cantidad = parseCantidad(l.cantidad);
    const porcion = parseCantidad(l.porcion);
    const mermaPct = l.merma === "" ? 0 : parseDecimal2(l.merma);
    const factor = unidades.find((u) => u.Codigo === unidadDe(l))?.Factor;
    if (cantidad === null || porcion === null || mermaPct === null || factor === undefined || !l.ingrediente) return null;
    return { cantidad, porcion, merma: mermaPct / 100, factorUnidad: factor, costoPorBase: costoBaseDe(l) };
  });
  const calculo = entradas.map((e) => (e ? calcularLinea(e) : null));
  const lineasCalculo = entradas.filter((e): e is LineaCalculo => e !== null);
  const porcionesNum = parseCantidad(porciones) ?? 1;
  const resumen = calcularReceta(lineasCalculo, porcionesNum);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    for (const [i, l] of lineas.entries()) {
      if (!l.ingrediente) return setError(`Línea ${i + 1}: elija el ingrediente`);
      if (parseCantidad(l.cantidad) === null) return setError(`Línea ${i + 1}: la cantidad debe ser un número mayor que 0 (hasta 3 decimales)`);
      if (parseCantidad(l.porcion) === null) return setError(`Línea ${i + 1}: la porción neta debe ser un número mayor que 0 (hasta 3 decimales)`);
      if (l.merma !== "" && parseDecimal2(l.merma) === null) return setError(`Línea ${i + 1}: la merma debe ser un porcentaje con hasta 2 decimales`);
    }
    start(async () => {
      const r = await guardarReceta({
        id: receta?.id, codigo, nombre, porciones, estado,
        rendimientoCantidad: rendCant, rendimientoUnidad: rendUnidad,
        detalle: lineas.map((l) => ({ tipo: l.tipo, ingrediente: l.ingrediente, cantidad: l.cantidad, porcion: l.porcion, unidad: unidadDe(l), merma: l.merma })),
      });
      if (r.error) setError(r.error);
      else router.push(despuesDeGuardar);
    });
  }

  return (
    <form onSubmit={enviar} className="grid gap-5">
      <div className="form-grid form-grid-4">
        <Field label="Código" hint="Opcional"><input value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={40} className="input" /></Field>
        <Field label="Nombre" className="fld-3"><input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={150} className="input" /></Field>
        <Field label="Porciones" hint="Cuántas porciones rinde la receta">
          <input value={porciones} onChange={(e) => setPorciones(filtrarDecimal(e.target.value, 2))} inputMode="decimal" autoComplete="off" required className="input" />
        </Field>
        <Field label="Rendimiento" hint="Opcional; obligatorio para usarla como sub-receta" className="fld-2">
          <div className="flex gap-2">
            <input value={rendCant} onChange={(e) => setRendCant(filtrarDecimal(e.target.value, 3))} inputMode="decimal" autoComplete="off" aria-label="Cantidad del rendimiento" className="input" />
            <select value={rendUnidad} onChange={(e) => setRendUnidad(e.target.value)} aria-label="Unidad del rendimiento" className="input">
              <option value="">—</option>
              {unidadesRendimiento.map((u) => <option key={u.Codigo} value={u.Codigo}>{u.Nombre}</option>)}
            </select>
          </div>
        </Field>
        {receta && (
          <Field label="Estado"><select value={estado} onChange={(e) => setEstado(e.target.value)} className="input"><option value="1">Vigente</option><option value="0">No vigente</option></select></Field>
        )}
      </div>

      <div className="grid gap-3">
        <h2 className="section-title">Ingredientes</h2>
        {lineas.map((l, i) => {
          const base = familiaDe(l);
          return (
            <div key={i} className="line-grid line-grid-7">
              <Field label="Tipo">
                <select value={l.tipo} onChange={(e) => setLinea(i, { tipo: e.target.value as LineaForm["tipo"], ingrediente: "", unidad: "" })} className="input">
                  <option value="producto">Producto</option><option value="subreceta">Sub-receta</option>
                </select>
              </Field>
              <Combobox
                key={l.tipo} label="Ingrediente" required opciones={l.tipo === "producto" ? opcionesProducto : opcionesSub} valor={l.ingrediente}
                onCambio={(v) => setLinea(i, { ingrediente: v, unidad: "" })} placeholder={l.tipo === "producto" ? "Busque por código o nombre" : "Busque por nombre"}
              />
              <Field label="Cantidad"><input value={l.cantidad} onChange={(e) => setLinea(i, { cantidad: filtrarDecimal(e.target.value, 3) })} inputMode="decimal" autoComplete="off" required className="input" /></Field>
              <Field label="Porción neta"><input value={l.porcion} onChange={(e) => setLinea(i, { porcion: filtrarDecimal(e.target.value, 3) })} inputMode="decimal" autoComplete="off" required className="input" /></Field>
              <Field label="Unidad">
                <select value={unidadDe(l)} onChange={(e) => setLinea(i, { unidad: e.target.value })} disabled={!l.ingrediente} required className="input">
                  {!l.ingrediente && <option value="">—</option>}
                  {unidadesDeFamilia(unidades, base, l.unidad).map((u) => <option key={u.Codigo} value={u.Codigo}>{u.Nombre}</option>)}
                </select>
              </Field>
              <Field label="Merma (%)"><input value={l.merma} onChange={(e) => setLinea(i, { merma: filtrarDecimal(e.target.value, 2) })} inputMode="decimal" autoComplete="off" placeholder="0" className="input" /></Field>
              <button type="button" aria-label={`Quitar línea ${i + 1}`} disabled={lineas.length === 1} onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))} className="btn btn-danger btn-icon"><Icon name="x" size={18} /></button>
              {calculo[i] && (
                <p className="text-muted line-grid-nota">
                  Cantidad bruta: {num(calculo[i]!.bruto)} {unidades.find((u) => u.Codigo === unidadDe(l))?.Nombre}
                  {" · "}{calculo[i]!.costo === null ? "sin costo" : clp(calculo[i]!.costo!)}
                </p>
              )}
            </div>
          );
        })}
        <div><button type="button" onClick={() => setLineas((ls) => [...ls, lineaVacia()])} className="btn btn-secondary btn-sm"><Icon name="plus" size={16} />Agregar ingrediente</button></div>
      </div>

      <dl className="resumen" aria-live="polite">
        <div><dt className="text-muted">Costo total{resumen.incompleto ? " (parcial)" : ""}</dt><dd>{clp(resumen.total)}</dd></div>
        <div className="resumen-total"><dt>Costo por porción{resumen.incompleto ? " (parcial)" : ""}</dt><dd>{clp(resumen.porcion)}</dd></div>
        {resumen.incompleto && <div className="text-muted">Incompleto: hay ingredientes sin costo (un producto sin factura registrada o una sub-receta incompleta).</div>}
      </dl>

      {error && <p role="alert" className="alert alert-error">{error}</p>}
      <div className="form-actions"><button disabled={pending} className="btn btn-primary">{pending ? "Guardando…" : receta ? "Guardar cambios" : "Crear receta"}</button></div>
    </form>
  );
}
