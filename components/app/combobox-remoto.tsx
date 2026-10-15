"use client";

import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import Combobox from "./combobox";
import type { Opcion } from "../../lib/buscar";

const ESPERA_MS = 250;

type Props = Omit<ComponentProps<typeof Combobox>, "opciones" | "onTexto" | "cargando" | "onCambio"> & {
  /** Busca en el servidor las opciones que coinciden con el texto (vacío = las primeras). */
  buscar: (texto: string) => Promise<Opcion[]>;
  /** Opciones ya elegidas (de este u otros campos): se muestran aunque no estén entre los resultados. */
  elegidas?: Opcion[];
  /** Avisa de la selección; `opcion` es null si se quitó. */
  onCambio: (valor: string, opcion: Opcion | null) => void;
};

/**
 * Combobox que busca en el servidor mientras se escribe (con una pequeña espera entre teclas) en vez de
 * cargar todo el catálogo en la página. Una respuesta atrasada nunca pisa a una más reciente.
 */
export default function ComboboxRemoto({ buscar, elegidas, onCambio, ...resto }: Props) {
  const [resultados, setResultados] = useState<Opcion[]>([]);
  const [cargando, setCargando] = useState(false);
  const vigente = useRef(0); // número de la última búsqueda pedida
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yaBuscoAlgo = useRef(false);

  useEffect(() => () => { if (espera.current) clearTimeout(espera.current); }, []);

  const alTexto = useCallback((texto: string) => {
    if (espera.current) clearTimeout(espera.current);
    const numero = ++vigente.current;
    const ejecutar = async () => {
      setCargando(true);
      try {
        const r = await buscar(texto);
        if (numero === vigente.current) { setResultados(r); yaBuscoAlgo.current = true; }
      } catch {
        if (numero === vigente.current) setResultados([]);
      } finally {
        if (numero === vigente.current) setCargando(false);
      }
    };
    // La primera búsqueda (al abrir la lista) no espera; las siguientes, sí.
    if (yaBuscoAlgo.current) espera.current = setTimeout(ejecutar, ESPERA_MS);
    else void ejecutar();
  }, [buscar]);

  // Resultados + lo ya elegido (sin repetir), para que la selección siempre se reconozca.
  const opciones = [...resultados, ...(elegidas ?? []).filter((e) => !resultados.some((o) => o.valor === e.valor))];

  return (
    <Combobox
      {...resto}
      opciones={opciones}
      onTexto={alTexto}
      cargando={cargando}
      onCambio={(valor) => onCambio(valor, opciones.find((o) => o.valor === valor) ?? null)}
    />
  );
}
