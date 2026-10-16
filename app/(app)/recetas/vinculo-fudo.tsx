"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ComboboxRemoto from "@/components/app/combobox-remoto";
import type { Opcion } from "@/lib/buscar";
import { buscarProductosFudo, vincularFudo } from "./actions";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

/** Elegir (o quitar) el producto de Fudo al que corresponde esta receta. */
export default function VinculoFudo({ idReceta, idFudo, nombreActual }: { idReceta: number; idFudo: string | null; nombreActual?: string }) {
  const router = useRouter();
  const [valor, setValor] = useState(idFudo ?? "");
  const [elegida, setElegida] = useState<Opcion | null>(idFudo ? { valor: idFudo, etiqueta: nombreActual ?? `Producto ${idFudo}`, busqueda: nombreActual ?? idFudo } : null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const buscar = useCallback(async (q: string): Promise<Opcion[]> => {
    const r = await buscarProductosFudo(q);
    setError(r.error ?? null);
    return r.productos.map((p) => ({ valor: p.id, etiqueta: `${p.nombre} — ${clp.format(p.precio)}`, busqueda: `${p.nombre} ${p.codigo ?? ""}` }));
  }, []);

  function guardar(nuevo: string) {
    setError(null);
    empezar(async () => {
      const r = await vincularFudo(idReceta, nuevo);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      <ComboboxRemoto
        label="Producto en Fudo" valor={valor} buscar={buscar} maxOpciones={20} placeholder="Busque por nombre en Fudo" limpiarAlSalir
        elegidas={elegida ? [elegida] : []}
        onCambio={(v, o) => { setValor(v); if (o) setElegida(o); }}
      />
      {error && <p role="alert" className="alert alert-error">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" disabled={pendiente || valor === (idFudo ?? "")} onClick={() => guardar(valor)}>
          {pendiente ? "Guardando…" : valor ? "Guardar vínculo" : "Quitar vínculo"}
        </button>
      </div>
    </div>
  );
}
