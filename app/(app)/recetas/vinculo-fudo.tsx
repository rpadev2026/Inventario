"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ComboboxRemoto from "@/components/app/combobox-remoto";
import Field from "@/components/app/field";
import type { Opcion } from "@/lib/buscar";
import { buscarProductosFudo, vincularFudo } from "./actions";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

/** Elegir (o quitar) el producto de Fudo al que corresponde esta receta. */
type Bodega = { id: number; nombre: string };

export default function VinculoFudo({ idReceta, idFudo, nombreActual, bodegas, idBodega }: {
  idReceta: number; idFudo: string | null; nombreActual?: string; bodegas: Bodega[]; idBodega: number | null;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(idFudo ?? "");
  const [bodega, setBodega] = useState(idBodega ? String(idBodega) : "");
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
    if (nuevo && !bodega) return setError("Elija la bodega de la que se descuenta el stock");
    empezar(async () => {
      const r = await vincularFudo(idReceta, nuevo, nuevo ? Number(bodega) : null);
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
      {valor && (
        <Field label="Bodega de la que se descuenta el stock">
          <select value={bodega} onChange={(e) => setBodega(e.target.value)} className="input">
            <option value="">Seleccione…</option>
            {bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </Field>
      )}
      {error && <p role="alert" className="alert alert-error">{error}</p>}
      {(valor || idFudo) && (
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" disabled={pendiente || (valor === (idFudo ?? "") && bodega === (idBodega ? String(idBodega) : ""))} onClick={() => guardar(valor)}>
            {pendiente ? "Guardando…" : valor ? "Guardar vínculo" : "Quitar vínculo"}
          </button>
        </div>
      )}
    </div>
  );
}
