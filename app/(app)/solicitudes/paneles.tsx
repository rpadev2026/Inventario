"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aprobarParcialSolicitud, aprobarSolicitud, recepcionarSolicitud } from "./actions";
import Field from "@/components/app/field";
import { hayCambioDeCantidades } from "@/lib/aprobacion-parcial";

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

type ItemAprobar = Item & { solicitada: number };

/**
 * Aprobación: «Aprobar» solo con las cantidades pedidas; si se cambia la cantidad de algún producto, la aprobación es PARCIAL:
 * se activa «Aprobar parcialmente» (y se desactiva «Aprobar») y exige un motivo de 1 a 100 caracteres.
 */
export function PanelAprobar({ id, items }: { id: number; items: ItemAprobar[] }) {
  const router = useRouter();
  const [vals, setVals] = useState(Object.fromEntries(items.map((i) => [String(i.producto), String(i.inicial)])));
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cambio = hayCambioDeCantidades(items.map((i) => ({ producto: i.producto, solicitada: i.solicitada })), vals);
  const lista = () => items.map((i) => ({ producto: i.producto, cantidad: Number(vals[String(i.producto)]) || 0 }));
  function enviar(parcial: boolean) {
    setError(null);
    start(async () => {
      const r = parcial ? await aprobarParcialSolicitud({ id, items: lista(), motivo }) : await aprobarSolicitud({ id, items: lista() });
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }
  return (
    <form onSubmit={(e) => e.preventDefault()} className="card grid gap-4">
      <h2 className="section-title">Cantidades a aprobar</h2>
      {items.map((i) => (
        <label key={i.producto} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <span className="text-sm">{i.nombre} <span className="text-muted">(pedido {i.solicitada}, máx. {i.max})</span></span>
          <input type="number" min="0" max={i.max} step="0.001" inputMode="decimal" value={vals[String(i.producto)]} onChange={(e) => setVals((v) => ({ ...v, [String(i.producto)]: e.target.value }))} className={f} />
        </label>
      ))}
      <Field label="Motivo de la aprobación parcial" hint={cambio ? "Obligatorio: aprobará menos de lo pedido. Máximo 100 caracteres." : "Se habilita al cambiar la cantidad de algún producto."}>
        <input name="motivo" maxLength={100} className="input" autoComplete="off" disabled={!cambio} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Field>
      <p className="text-sm text-muted">{`${motivo.length}/100`}</p>
      {error && <p role="alert" className="msg msg-error">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => enviar(false)} disabled={pending || cambio} className="btn btn-primary">{pending ? "Procesando…" : "Aprobar"}</button>
        <button type="button" onClick={() => enviar(true)} disabled={pending || !cambio || motivo.trim() === ""} className="btn btn-secondary">Aprobar parcialmente</button>
      </div>
    </form>
  );
}

export const PanelRecepcion = (p: { id: number; items: Item[] }) =>
  <Panel {...p} titulo="Cantidades recibidas ahora" boton="Registrar recepción" accion={recepcionarSolicitud} />;
