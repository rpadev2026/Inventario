import type { ReactNode } from "react";

/** Campo de formulario con etiqueta siempre visible (nunca solo placeholder). El <label> envuelve al control. */
export default function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <label className={`field${className ? " " + className : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
