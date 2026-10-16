"use client";

import { useState, useTransition } from "react";
import type { ResumenSincronizacion } from "@/lib/services/sincronizar-ventas";
import { sincronizarAhora } from "./actions";

export default function Sincronizar() {
  const [r, setR] = useState<{ error?: string; resumen?: ResumenSincronizacion } | null>(null);
  const [pendiente, empezar] = useTransition();
  return (
    <div className="space-y-3">
      <button type="button" className="btn btn-primary" disabled={pendiente} onClick={() => empezar(async () => setR(await sincronizarAhora()))}>
        {pendiente ? "Sincronizando…" : "Sincronizar ventas ahora"}
      </button>
      {r?.error && <p role="alert" className="alert alert-error">{r.error}</p>}
      {r?.resumen && (
        <p role="status" className={`alert ${r.resumen.errores.length ? "alert-warn" : "alert-ok"}`}>
          {r.resumen.revisadas} ventas revisadas: {r.resumen.procesadas} descontadas, {r.resumen.yaProcesadas} ya estaban
          {r.resumen.lineasOmitidas > 0 && `, ${r.resumen.lineasOmitidas} líneas sin receta o sin bodega`}.
          {r.resumen.errores.length > 0 && ` Con error: ${r.resumen.errores.join("; ")}`}
        </p>
      )}
    </div>
  );
}
