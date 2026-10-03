"use client";
import { useEffect, useId, useRef, useState } from "react";
import Icon from "@/components/app/icon";
import FormBodega from "./form";

/** Encabezado de Bodegas con el botón que despliega el formulario de creación (cerrado al entrar). */
export default function PanelNuevaBodega({ puedeCrear }: { puedeCrear: boolean }) {
  const idPanel = useId();
  const [abierto, setAbierto] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const yaMontado = useRef(false);

  // Al abrir con el botón, el foco pasa al primer campo (no al cargar la página).
  useEffect(() => {
    if (!yaMontado.current) { yaMontado.current = true; return; }
    if (abierto) panel.current?.querySelector<HTMLInputElement>("input[name=nombre]")?.focus();
  }, [abierto]);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Bodegas</h1>
        {puedeCrear && (
          <button type="button" className={`btn ${abierto ? "btn-secondary" : "btn-primary"}`}
            aria-expanded={abierto} aria-controls={idPanel} onClick={() => setAbierto((a) => !a)}>
            {!abierto && <Icon name="plus" size={18} />}
            {abierto ? "Cerrar" : "Crear bodega"}
          </button>
        )}
      </div>
      {puedeCrear && (
        <div id={idPanel} ref={panel} hidden={!abierto}>
          <div className="card">
            <h2 className="section-title mb-3">Nueva bodega</h2>
            <FormBodega onGuardado={() => setAbierto(false)} />
          </div>
        </div>
      )}
    </>
  );
}
