"use client";
import { useEffect, useRef, useState } from "react";
import Field from "@/components/app/field";
import { esCorreoValido, MSG_CORREO } from "@/lib/validation/correo";

/**
 * Campo de correo con validación de formato (la misma regla del servidor).
 * Muestra el mensaje junto al campo al salir de él y bloquea el envío mientras el formato sea inválido.
 * Si no es obligatorio, vacío es válido.
 */
export default function CampoCorreo({ defaultValue, className, label = "Correo", required, autoComplete = "off", marcado }: {
  defaultValue?: string | null; className?: string; label?: string; required?: boolean; autoComplete?: string;
  /** Marca el campo como inválido por un motivo externo (p. ej. credenciales rechazadas). */
  marcado?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [valor, setValor] = useState(defaultValue ?? "");
  const [tocado, setTocado] = useState(false);
  const invalido = valor.trim() !== "" && !esCorreoValido(valor.trim());

  // El envío del formulario queda bloqueado por el navegador mientras el valor sea inválido.
  useEffect(() => { ref.current?.setCustomValidity(invalido ? MSG_CORREO : ""); }, [invalido]);

  const mostrarError = tocado && invalido;
  return (
    <Field label={label} className={className} hint={mostrarError ? MSG_CORREO : undefined}>
      <input ref={ref} name="correo" type="email" inputMode="email" autoComplete={autoComplete} className="input" value={valor} required={required}
        aria-invalid={mostrarError || marcado ? true : undefined}
        onChange={(e) => setValor(e.target.value)} onBlur={() => setTocado(true)} />
    </Field>
  );
}
