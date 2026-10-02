"use client";
import { useEffect, useId, useRef, useState } from "react";
import Icon from "@/components/app/icon";
import type { Territorio } from "@/lib/territorio-opciones";
import { FormProveedor } from "./forms";

/** Encabezado de Proveedores con el botón que despliega el formulario de creación (cerrado al entrar, salvo al venir de una factura). */
export default function PanelNuevoProveedor({ territorio, volver, abiertoInicial }: {
  territorio: Territorio; volver?: string; abiertoInicial: boolean;
}) {
  const idPanel = useId();
  const [abierto, setAbierto] = useState(abiertoInicial);
  const panel = useRef<HTMLDivElement>(null);
  const yaMontado = useRef(false);

  // Al abrir con el botón, el foco pasa al primer campo (no al cargar la página).
  useEffect(() => {
    if (!yaMontado.current) { yaMontado.current = true; return; }
    if (abierto) panel.current?.querySelector<HTMLInputElement>("input[name=rut]")?.focus();
  }, [abierto]);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Proveedores</h1>
        <button type="button" className={`btn ${abierto ? "btn-secondary" : "btn-primary"}`}
          aria-expanded={abierto} aria-controls={idPanel} onClick={() => setAbierto((a) => !a)}>
          {!abierto && <Icon name="plus" size={18} />}
          {abierto ? "Cerrar" : "Crear proveedor"}
        </button>
      </div>
      <div id={idPanel} ref={panel} hidden={!abierto}>
        <div className="card">
          <h2 className="section-title mb-3">Nuevo proveedor</h2>
          <FormProveedor territorio={territorio} volver={volver} onGuardado={() => setAbierto(false)} />
        </div>
      </div>
    </>
  );
}
