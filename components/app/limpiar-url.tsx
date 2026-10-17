"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { esFiltro } from "@/lib/filtros-url";

/**
 * Quita de la URL visible los filtros de los listados (`pagina`, `q`, `estado`...): el servidor ya los aplicó y los guardó
 * (ver lib/filtros-url.ts). Solo cambia la barra de direcciones; no navega ni vuelve a pedir la página.
 */
export default function LimpiarUrl() {
  const ruta = usePathname();
  const busqueda = useSearchParams();
  useEffect(() => {
    const u = new URL(window.location.href);
    const claves = [...u.searchParams.keys()].filter(esFiltro);
    if (claves.length === 0) return;
    for (const k of new Set(claves)) u.searchParams.delete(k);
    window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
  }, [ruta, busqueda]);
  return null;
}
