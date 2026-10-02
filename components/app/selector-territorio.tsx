"use client";

import { useEffect, useRef, useState } from "react";
import Combobox from "./combobox";
import { opcionesCiudad, opcionesComuna, opcionesRegion, siguienteSeleccion, type Seleccion, type Territorio } from "../../lib/territorio-opciones";

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
          onCambio={(v) => setSel((s) => siguienteSeleccion(s, "region", v))}
          maxOpciones={MAX}
          limpiarAlSalir
        />
        <Combobox
          label="Ciudad (provincia)"
          opciones={opcionesCiudad(territorio, sel.region, inicial.ciudad)}
          valor={sel.ciudad ?? ""}
          onCambio={(v) => setSel((s) => siguienteSeleccion(s, "ciudad", v))}
          maxOpciones={MAX}
          limpiarAlSalir
          hint={sel.region ? undefined : "Elija primero una región"}
        />
        <Combobox
          label="Comuna"
          opciones={opcionesComuna(territorio, sel.ciudad, inicial.comuna)}
          valor={sel.comuna ?? ""}
          onCambio={(v) => setSel((s) => siguienteSeleccion(s, "comuna", v))}
          maxOpciones={MAX}
          limpiarAlSalir
          hint={sel.ciudad ? undefined : "Elija primero una ciudad"}
        />
      </div>
      <input ref={ancla} type="hidden" name="region" value={sel.region ?? ""} />
      <input type="hidden" name="ciudad" value={sel.ciudad ?? ""} />
      <input type="hidden" name="comuna" value={sel.comuna ?? ""} />
    </div>
  );
}
