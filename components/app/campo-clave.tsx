"use client";
import { useState } from "react";
import Field from "./field";
import Icon from "./icon";
import { requisitosClave } from "@/lib/validation/password";

/** Campo de clave nueva con la lista de requisitos SIEMPRE visible; cada uno se marca al cumplirse (con ícono y texto, no solo color). */
export default function CampoClave({ label, name, hint, className }: { label: string; name: string; hint?: string; className?: string }) {
  const [valor, setValor] = useState("");
  return (
    <div className={`grid gap-2${className ? " " + className : ""}`}>
      <Field label={label} hint={hint}>
        <input name={name} type="password" required autoComplete="new-password" className="input" onChange={(e) => setValor(e.target.value)} />
      </Field>
      <ul className="requisitos" aria-label="Requisitos de la clave">
        {requisitosClave(valor).filter((r) => !(r.soloSiFalla && r.cumple)).map((r) => (
          <li key={r.texto} className={r.cumple ? "requisito requisito-ok" : "requisito"}>
            <span className="requisito-marca" aria-hidden="true">{r.cumple && <Icon name="check" size={14} />}</span>
            <span className="sr-only">{r.cumple ? "Cumplido: " : "Pendiente: "}</span>
            {r.texto}
          </li>
        ))}
      </ul>
    </div>
  );
}
