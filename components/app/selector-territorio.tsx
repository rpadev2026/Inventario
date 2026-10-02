"use client";

import { useEffect, useRef, useState } from "react";
import Combobox from "./combobox";
import { opcionesCiudad, opcionesComuna, opcionesRegion, type Seleccion, type Territorio } from "../../lib/territorio-opciones";

const MAX = 1000; // las listas territoriales se navegan completas, sin teclear

/** Región → Ciudad → Comuna dependientes; envía los códigos en inputs ocultos `region|ciudad|comuna`. */
export default function SelectorTerritorio({ territorio, inicial }: { territorio: Territorio; inicial: Seleccion }) {
  const [sel, setSel] = useState<Seleccion>(inicial);
  const ancla = useRef<HTMLInputElement>(null);

  // `useAccion` limpia el formulario con form.reset(); el estado de React debe seguirlo.
  const inicialRef = useRef(inicial);
  inicialRef.current = inicial;
  useEffect(() => {
    const form = ancla.current?.form;
    if (!form) return;
    const alReiniciar = () => setSel(inicialRef.current);
    form.addEventListener("reset", alReiniciar);
    return () => form.removeEventListener("reset", alReiniciar);
  }, []);

  return (
    <div className="fld-full">
      <div className="form-grid form-grid-3">
        <Combobox
          label="Región"
          opciones={opcionesRegion(territorio, inicial.region)}
          valor={sel.region ?? ""}
          onCambio={(v) => setSel({ region: v || null, ciudad: null, comuna: null })}
          maxOpciones={MAX}
        />
        <Combobox
          label="Ciudad"
          opciones={opcionesCiudad(territorio, sel.region, inicial.ciudad)}
          valor={sel.ciudad ?? ""}
          onCambio={(v) => setSel((s) => ({ ...s, ciudad: v || null, comuna: null }))}
          maxOpciones={MAX}
        />
        <Combobox
          label="Comuna"
          opciones={opcionesComuna(territorio, sel.ciudad, inicial.comuna)}
          valor={sel.comuna ?? ""}
          onCambio={(v) => setSel((s) => ({ ...s, comuna: v || null }))}
          maxOpciones={MAX}
        />
      </div>
      <input ref={ancla} type="hidden" name="region" value={sel.region ?? ""} />
      <input type="hidden" name="ciudad" value={sel.ciudad ?? ""} />
      <input type="hidden" name="comuna" value={sel.comuna ?? ""} />
    </div>
  );
}
