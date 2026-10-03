"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Field from "@/components/app/field";

const ESPERA_MS = 300;

/**
 * Filtros de un listado (nombre/texto y estado). Al escribir el nombre (o cambiar el estado) el listado se filtra solo,
 * con una pequeña espera entre teclas; «Buscar» aplica de inmediato. Sin JavaScript el formulario sigue
 * funcionando como búsqueda normal (GET). Cualquier filtro nuevo vuelve a la página 1 y conserva el tamaño.
 */
export default function FiltrosListado({ ruta, etiqueta, campo = "Nombre", q, estado, tam }: {
  /** Ruta del listado (p. ej. «/bodegas»). */ ruta: string;
  /** Nombre accesible del formulario de búsqueda (p. ej. «Buscar bodegas»). */ etiqueta: string;
  /** Etiqueta visible del cuadro de texto. */ campo?: string;
  q?: string; estado?: string; tam?: string;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(q ?? "");
  const [est, setEst] = useState(estado ?? "");
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Último filtro enviado a la URL: evita pisar lo que se está escribiendo cuando la página responde.
  const aplicado = useRef({ q: (q ?? "").trim(), estado: estado ?? "" });

  // Si la URL cambia desde fuera (Atrás, enlace «Limpiar»), el formulario la sigue.
  useEffect(() => {
    const nq = (q ?? "").trim(), ne = estado ?? "";
    if (nq !== aplicado.current.q || ne !== aplicado.current.estado) {
      aplicado.current = { q: nq, estado: ne };
      setTexto(q ?? "");
      setEst(ne);
    }
  }, [q, estado]);

  useEffect(() => () => { if (espera.current) clearTimeout(espera.current); }, []);

  function aplicar(t: string, e: string) {
    if (espera.current) clearTimeout(espera.current);
    const nq = t.trim();
    if (nq === aplicado.current.q && e === aplicado.current.estado) return;
    aplicado.current = { q: nq, estado: e };
    const p = new URLSearchParams();
    if (tam) p.set("tam", tam);
    if (nq) p.set("q", nq);
    if (e) p.set("estado", e);
    const s = p.toString();
    router.replace(s ? `${ruta}?${s}` : ruta, { scroll: false });
  }
  const programar = (t: string, e: string) => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => aplicar(t, e), ESPERA_MS);
  };
  const hayFiltro = texto.trim() !== "" || est !== "";

  return (
    <form method="get" action={ruta} role="search" aria-label={etiqueta} className="form-grid form-grid-4 items-end"
      onSubmit={(ev) => { ev.preventDefault(); aplicar(texto, est); }}>
      {tam && <input type="hidden" name="tam" value={tam} />}
      <Field label={campo} className="fld-2">
        <input name="q" type="search" value={texto} className="input" autoComplete="off"
          onChange={(ev) => { setTexto(ev.target.value); programar(ev.target.value, est); }} />
      </Field>
      <Field label="Estado">
        <select name="estado" value={est} className="input"
          onChange={(ev) => { setEst(ev.target.value); aplicar(texto, ev.target.value); }}>
          <option value="">Todos</option><option value="1">Vigente</option><option value="0">No vigente</option>
        </select>
      </Field>
      <div className="form-actions">
        <button className="btn btn-primary">Buscar</button>
        {hayFiltro && (
          <button type="button" className="btn btn-secondary" onClick={() => { setTexto(""); setEst(""); aplicar("", ""); }}>Limpiar</button>
        )}
      </div>
    </form>
  );
}
