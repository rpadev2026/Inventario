"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { filtrarOpciones, type Opcion } from "../../lib/buscar";

type Props = {
  label: string;
  opciones: Opcion[];
  /** `valor` de la opción elegida; "" si no hay selección. */
  valor: string;
  onCambio: (valor: string) => void;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** Máximo de opciones mostradas (por defecto el de `filtrarOpciones`). */
  maxOpciones?: number;
  /**
   * Campo opcional cuyo valor enviado debe coincidir con lo que se ve: teclear no borra la selección;
   * al salir, un texto vacío la quita y un texto que no corresponde a una opción vuelve a la selección vigente.
   */
  limpiarAlSalir?: boolean;
};

/** Autocompletado accesible (patrón ARIA 1.2 combobox con lista). El filtrado vive en lib/buscar.ts. */
export default function Combobox({ label, opciones, valor, onCambio, required, placeholder, hint, maxOpciones, limpiarAlSalir }: Props) {
  const uid = useId();
  const idInput = `${uid}-input`;
  const idLista = `${uid}-lista`;
  const idHint = `${uid}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);

  const elegida = opciones.find((o) => o.valor === valor) ?? null;
  const [texto, setTexto] = useState(elegida?.etiqueta ?? "");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);

  // Si la selección cambia desde fuera (p. ej. al restaurar un borrador), el texto la sigue.
  const [valorPrevio, setValorPrevio] = useState(valor);
  if (valor !== valorPrevio) {
    setValorPrevio(valor);
    if (elegida && elegida.etiqueta !== texto) setTexto(elegida.etiqueta);
    if (!valor && elegida === null && texto !== "" && !abierto) setTexto("");
  }

  const filtradas = useMemo(() => filtrarOpciones(opciones, elegida && texto === elegida.etiqueta ? "" : texto, maxOpciones), [opciones, texto, elegida, maxOpciones]);
  const indiceActivo = Math.min(activo, Math.max(filtradas.length - 1, 0));
  const idOpcion = (i: number) => `${uid}-op-${i}`;
  const lista = abierto && filtradas.length > 0;
  const sinResultados = abierto && filtradas.length === 0;

  // `required` sin selección bloquea el envío con la validación nativa, anclada al campo visible.
  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !elegida ? "Elige una opción de la lista" : "");
  }, [required, elegida]);

  // Con el teclado, la opción activa siempre queda visible dentro de la lista con scroll.
  useEffect(() => {
    if (!lista) return;
    document.getElementById(`${uid}-op-${indiceActivo}`)?.scrollIntoView({ block: "nearest" });
  }, [lista, indiceActivo, uid]);

  function elegir(o: Opcion) {
    setTexto(o.etiqueta);
    setAbierto(false);
    onCambio(o.valor);
  }

  function alEscribir(v: string) {
    setTexto(v);
    setActivo(0);
    setAbierto(true);
    if (valor && !limpiarAlSalir) onCambio("");
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!abierto) setAbierto(true);
      else setActivo(Math.min(indiceActivo + 1, filtradas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto) setAbierto(true);
      else setActivo(Math.max(indiceActivo - 1, 0));
    } else if (e.key === "Enter") {
      if (lista && filtradas[indiceActivo]) {
        e.preventDefault();
        elegir(filtradas[indiceActivo]);
      }
    } else if (e.key === "Escape") {
      if (abierto) {
        e.preventDefault();
        setAbierto(false);
      }
    }
  }

  return (
    // Usa su propio div.field y no <Field>: Field envuelve todo en un <label> y aquí la lista de opciones no puede ir dentro de uno.
    <div className="field" style={{ position: "relative" }}>
      <label className="field-label" htmlFor={idInput}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={idInput}
        className="input"
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={lista}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={lista ? idOpcion(indiceActivo) : undefined}
        aria-describedby={hint ? idHint : undefined}
        aria-required={required || undefined}
        required={required}
        placeholder={placeholder}
        value={texto}
        onChange={(e) => alEscribir(e.target.value)}
        onKeyDown={alTeclear}
        onFocus={() => setAbierto(true)}
        onBlur={() => {
          setAbierto(false);
          if (limpiarAlSalir) {
            if (texto.trim() === "") {
              if (valor) onCambio("");
              setTexto("");
            } else setTexto(elegida?.etiqueta ?? "");
          } else if (elegida) setTexto(elegida.etiqueta);
        }}
        onMouseDown={() => setAbierto(true)}
      />
      <ul id={idLista} role="listbox" aria-label={label} className="combo-list" hidden={!lista}>
        {lista &&
          filtradas.map((o, i) => (
            <li
              key={o.valor}
              id={idOpcion(i)}
              role="option"
              aria-selected={i === indiceActivo}
              data-elegida={o.valor === valor ? "true" : undefined}
              className="combo-option"
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(o);
              }}
              onMouseMove={() => setActivo(i)}
            >
              {o.etiqueta}
            </li>
          ))}
      </ul>
      {/* Siempre montado (para que los lectores de pantalla lo anuncien); vacío no ocupa espacio. */}
      <p className="field-hint" role="status" style={sinResultados ? undefined : { marginTop: "-.375rem" }}>
        {sinResultados ? "Sin resultados" : ""}
      </p>
      {hint && (
        <span id={idHint} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  );
}
