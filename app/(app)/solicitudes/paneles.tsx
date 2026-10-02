"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aprobarSolicitud, recepcionarSolicitud } from "./actions";

type Item = { codigo: string; nombre: string; max: number; inicial: number };
const f = "input w-full sm:w-32 sm:text-right";

function Panel({ id, items, titulo, boton, accion }: {
  id: number; items: Item[]; titulo: string; boton: string;
  accion: (i: { id: number; items: { codigo: string; cantidad: number }[] }) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [vals, setVals] = useState(Object.fromEntries(items.map((i) => [i.codigo, String(i.inicial)])));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function enviar() {
    setError(null);
    start(async () => {
      const r = await accion({ id, items: items.map((i) => ({ codigo: i.codigo, cantidad: Number(vals[i.codigo]) || 0 })) });
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }
  return (
    <form action={enviar} className="card grid gap-4">
      <h2 className="section-title">{titulo}</h2>
      {items.map((i) => (
        <label key={i.codigo} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <span className="text-sm">{i.codigo} — {i.nombre} <span className="text-muted">(máx. {i.max})</span></span>
          <input type="number" min="0" max={i.max} step="0.001" inputMode="decimal" value={vals[i.codigo]} onChange={(e) => setVals((v) => ({ ...v, [i.codigo]: e.target.value }))} className={f} />
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
