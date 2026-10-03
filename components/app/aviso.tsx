"use client";
import { useEffect, useState } from "react";

/**
 * Mensaje breve en el encabezado que se difumina solo (≈4,5 s). Quita `?aviso=` de la URL
 * para que no reaparezca al recargar ni se arrastre a los enlaces de paginación.
 */
export default function Aviso({ texto }: { texto: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.has("aviso")) {
      u.searchParams.delete("aviso");
      window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    }
    const t = setTimeout(() => setVisible(false), 4500);
    return () => clearTimeout(t);
  }, []);
  return visible ? <span role="status" className="aviso">{texto}</span> : null;
}
