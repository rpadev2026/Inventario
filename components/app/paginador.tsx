"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";
import { TAMANOS, type Paginacion } from "@/lib/paginacion";

/**
 * Control de paginación: «Mostrando X–Y de N», filas por página y Anterior/Siguiente.
 * El estado vive en la URL (`paramPagina` y `paramTam`); el resto de la consulta se conserva.
 */
export default function Paginador({ pg, paramPagina = "pagina", paramTam = "tam", etiqueta }: {
  pg: Paginacion; paramPagina?: string; paramTam?: string; etiqueta: string;
}) {
  const ruta = usePathname();
  const actual = useSearchParams();
  const router = useRouter();
  const idTam = useId();

  const url = (cambios: Record<string, string | null>) => {
    const q = new URLSearchParams(actual.toString());
    for (const [k, v] of Object.entries(cambios)) v === null ? q.delete(k) : q.set(k, v);
    const s = q.toString();
    return s ? `${ruta}?${s}` : ruta;
  };
  const irA = (p: number) => url({ [paramPagina]: p === 1 ? null : String(p) });
  const conteo = pg.total === 0 ? "Sin registros" : `Mostrando ${pg.desde}–${pg.hasta} de ${pg.total}`;

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label={`Paginación de ${etiqueta}`}>
      <p className="text-muted" role="status">{conteo}</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor={idTam} className="field-label">Filas por página</label>
          <select id={idTam} className="input" style={{ width: "auto" }} value={pg.tam}
            onChange={(e) => router.push(url({ [paramTam]: e.target.value, [paramPagina]: null }))}>
            {TAMANOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {pg.totalPaginas > 1 && (
          <div className="flex items-center gap-2">
            {pg.pagina > 1
              ? <Link href={irA(pg.pagina - 1)} className="btn btn-secondary" rel="prev">Anterior</Link>
              : <button type="button" className="btn btn-secondary" disabled>Anterior</button>}
            <span aria-current="page">Página {pg.pagina} de {pg.totalPaginas}</span>
            {pg.pagina < pg.totalPaginas
              ? <Link href={irA(pg.pagina + 1)} className="btn btn-secondary" rel="next">Siguiente</Link>
              : <button type="button" className="btn btn-secondary" disabled>Siguiente</button>}
          </div>
        )}
      </div>
    </nav>
  );
}
