"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aprobarSolicitud, recepcionarSolicitud } from "./actions";

type Item = { producto: number; nombre: string; max: number; inicial: number };
const f = "input w-full sm:w-32 sm:text-right";

function Panel({ id, items, titulo, boton, accion }: {
  id: number; items: Item[]; titulo: string; boton: string;
  accion: (i: { id: number; items: { producto: number; cantidad: number }[] }) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [vals, setVals] = useState(Object.fromEntries(items.map((i) => [String(i.producto), String(i.inicial)])));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function enviar() {
    setError(null);
    start(async () => {
      const r = await accion({ id, items: items.map((i) => ({ producto: i.producto, cantidad: Number(vals[String(i.producto)]) || 0 })) });
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }
  return (
    <form action={enviar} className="card grid gap-4">
      <h2 className="section-title">{titulo}</h2>
      {items.map((i) => (
        <label key={i.producto} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <span className="text-sm">{i.nombre} <span className="text-muted">(máx. {i.max})</span></span>
          <input type="number" min="0" max={i.max} step="0.001" inputMode="decimal" value={vals[String(i.producto)]} onChange={(e) => setVals((v) => ({ ...v, [String(i.producto)]: e.target.value }))} className={f} />
        </label>
      ))}
      {error && <p role="alert" className="msg msg-error">{error}</p>}
      <div><button disabled={pending} className="btn btn-primary">{pending ? "Procesando…" : boton}</button></div>
    </form>
  );
}

export const PanelAprobar = (p: { id: number; items: Item[] }) =>
  <Panel {...p} titulo="Cantidades a aprobar" boton="Aprobar" accion={aprobarSolicitud} />;

export const PanelRecepcion = (p: { id: number; items: Item[] }) =>
  <Panel {...p} titulo="Cantidades recibidas ahora" boton="Registrar recepción" accion={recepcionarSolicitud} />;
