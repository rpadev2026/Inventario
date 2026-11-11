"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TRABAJO, type EstadoTrabajos, type TrabajoFudo } from "@/lib/services/cola-fudo";
import { sincronizarAhora } from "./actions";

const CADA_MS = 3000; // mientras hay un trabajo activo, la pantalla se actualiza sola
const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });

/** Botón «Sincronizar» + estado del trabajo en segundo plano: en espera, procesando (con avance) y el resultado de la última vez. */
export default function Sincronizar({ actual, ultimo }: EstadoTrabajos) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pidiendo, pedir] = useTransition();
  const activo = actual !== null;

  useEffect(() => {
    if (!activo) return;
    const t = setInterval(() => router.refresh(), CADA_MS);
    return () => clearInterval(t);
  }, [activo, router]);

  const bloqueado = activo || pidiendo;
  return (
    <div className="space-y-3">
      <button type="button" className="btn btn-primary" disabled={bloqueado} onClick={() => { setError(null); pedir(async () => { const r = await sincronizarAhora(); if (r.error) setError(r.error); }); }}>
        {bloqueado ? "Sincronizando…" : "Sincronizar ventas ahora"}
      </button>
      {error && <p role="alert" className="alert alert-error">{error}</p>}
      {actual ? <EnCurso t={actual} /> : ultimo && <Resultado t={ultimo} />}
    </div>
  );
}

function EnCurso({ t }: { t: TrabajoFudo }) {
  const r = t.Resumen;
  const total = r?.total ?? 0, hechas = r?.revisadas ?? 0;
  const conAvance = t.Estado === TRABAJO.procesando && total > 0;
  return (
    <div role="status" aria-live="polite" className="alert alert-warn space-y-2">
      <p className="font-semibold">
        {t.Estado === TRABAJO.pendiente ? "Sincronización en espera de iniciar…" : conAvance ? `Sincronizando ventas… ${hechas} de ${total} revisadas` : "Sincronizando ventas… consultando a Fudo"}
      </p>
      <div className={`progress${conAvance ? "" : " progress-indeterminada"}`} role="progressbar" aria-label="Avance de la sincronización"
        {...(conAvance ? { "aria-valuemin": 0, "aria-valuemax": total, "aria-valuenow": hechas } : {})}>
        <span style={conAvance ? { width: `${Math.round((hechas / total) * 100)}%` } : undefined} />
      </div>
      <p className="text-sm">Corre en segundo plano: puede seguir usando la aplicación o salir de esta pantalla. Los datos se actualizan solos al terminar.</p>
    </div>
  );
}

function Resultado({ t }: { t: TrabajoFudo }) {
  const cuando = t.FechaFin ? ` (${fechaHora(t.FechaFin)})` : "";
  if (t.Estado === TRABAJO.error) return <p role="alert" className="alert alert-error">La última sincronización falló{cuando}: {t.Error ?? "error desconocido"}</p>;
  const r = t.Resumen;
  if (!r) return null;
  const errores = r.errores ?? [];
  return (
    <p role="status" className={`alert ${errores.length ? "alert-warn" : "alert-ok"}`}>
      Última sincronización{cuando}: {r.revisadas ?? 0} ventas revisadas, {r.procesadas ?? 0} descontadas, {r.yaProcesadas ?? 0} ya estaban
      {(r.lineasOmitidas ?? 0) > 0 && `, ${r.lineasOmitidas} líneas sin receta o sin bodega`}.
      {errores.length > 0 && ` Con error: ${errores.join("; ")}`}
    </p>
  );
}
