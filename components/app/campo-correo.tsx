"use client";
import { useEffect, useRef, useState } from "react";
import Field from "@/components/app/field";
import { esCorreoValido, MSG_CORREO } from "@/lib/validation/correo";

/**
 * Campo de correo opcional con validación de formato (la misma regla del servidor).
 * Muestra el mensaje junto al campo al salir de él y bloquea el envío mientras el formato sea inválido.
 */
export default function CampoCorreo({ defaultValue, className, label = "Correo" }: { defaultValue?: string | null; className?: string; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [valor, setValor] = useState(defaultValue ?? "");
  const [tocado, setTocado] = useState(false);
  const invalido = valor.trim() !== "" && !esCorreoValido(valor.trim());

  // El envío del formulario queda bloqueado por el navegador mientras el valor sea inválido.
  useEffect(() => { ref.current?.setCustomValidity(invalido ? MSG_CORREO : ""); }, [invalido]);

  return (
    <Field label={label} className={className} hint={tocado && invalido ? MSG_CORREO : undefined}>
      <input ref={ref} name="correo" type="email" inputMode="email" autoComplete="off" className="input" value={valor}
        aria-invalid={tocado && invalido ? true : undefined}
        onChange={(e) => setValor(e.target.value)} onBlur={() => setTocado(true)} />
    </Field>
  );
}
