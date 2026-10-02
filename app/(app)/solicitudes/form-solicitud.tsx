"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarSolicitud } from "./actions";
import Field from "@/components/app/field";
import Icon from "@/components/app/icon";

type Linea = { codigo: string; cantidad: string };

export default function FormSolicitud(props: {
  bodegas: { id: number; nombre: string }[];
  productos: { codigo: string; nombre: string; unidad: string }[];
  inicial?: { idSolicitud: number; idBodega: number; lineas: Linea[] };
}) {
  const router = useRouter();
  const [idBodega, setIdBodega] = useState(String(props.inicial?.idBodega ?? ""));
  const [lineas, setLineas] = useState<Linea[]>(props.inicial?.lineas ?? [{ codigo: "", cantidad: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (i: number, k: keyof Linea, v: string) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  function guardar() {
    setError(null);
    start(async () => {
      const r = await guardarSolicitud({ idSolicitud: props.inicial?.idSolicitud, idBodega, items: lineas });
      if (r.error) setError(r.error);
      else router.push(`/solicitudes/${r.id}`);
    });
  }

  return (
    <form action={guardar} className="card grid gap-4">
      <Field label="Bodega destino">
        <select value={idBodega} onChange={(e) => setIdBodega(e.target.value)} required className="input">
          <option value="">Seleccione…</option>
          {props.bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select>
      </Field>
      <div className="grid gap-3">
        <h2 className="section-title">Productos solicitados</h2>
        {lineas.map((l, i) => (
          <div key={i} className="line-grid line-grid-3">
            <Field label="Producto">
              <select value={l.codigo} onChange={(e) => set(i, "codigo", e.target.value)} required className="input">
                <option value="">Seleccione…</option>
                {props.productos.map((p) => <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.nombre} ({p.unidad})</option>)}
              </select>
            </Field>
            <Field label="Cantidad">
              <input type="number" min="0.001" step="0.001" inputMode="decimal" value={l.cantidad} onChange={(e) => set(i, "cantidad", e.target.value)} required className="input" />
            </Field>
            <button type="button" aria-label={`Quitar producto ${i + 1}`} disabled={lineas.length === 1} onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))} className="btn btn-danger btn-icon"><Icon name="x" size={18} /></button>
          </div>
        ))}
        <div><button type="button" onClick={() => setLineas((ls) => [...ls, { codigo: "", cantidad: "" }])} className="btn btn-secondary btn-sm"><Icon name="plus" size={16} />Agregar producto</button></div>
      </div>
      {error && <p role="alert" className="alert alert-error">{error}</p>}
      <div><button disabled={pending} className="btn btn-primary">{pending ? "Guardando…" : "Guardar borrador"}</button></div>
    </form>
  );
}
