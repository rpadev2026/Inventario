"use client";
import { useState, useTransition, type FormEvent } from "react";

type Resultado = { error?: string; ok?: boolean };

/**
 * Envía un formulario a una server action sin que React 19 lo reinicie al terminar:
 * si hay error se conserva lo digitado; si guardó bien (ok) se limpia el formulario.
 */
export function useAccion<R extends Resultado>(
  accion: (prev: unknown, fd: FormData) => Promise<R>,
  opciones?: { limpiarSiOk?: boolean; onOk?: (r: R, fd: FormData) => void },
) {
  const [state, setState] = useState<R | undefined>();
  const [pending, start] = useTransition();
  const limpiar = opciones?.limpiarSiOk ?? true;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await accion(undefined, fd);
      setState(r);
      if (r.ok) {
        opciones?.onOk?.(r, fd);
        if (limpiar) form.reset();
      }
    });
  }
  return { state, pending, onSubmit };
}
