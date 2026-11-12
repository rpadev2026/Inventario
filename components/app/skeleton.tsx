/** Esqueletos de carga: bloques planos que ocupan el lugar del contenido (mismo alto y rejilla) para que la página no salte al llegar. Estilos en app/tema.css. */

/** Un bloque; `ancho` y `alto` en cualquier unidad CSS. Decorativo: lo anuncia el contenedor. */
export function Skeleton({ ancho = "100%", alto = "1rem", className = "" }: { ancho?: string; alto?: string; className?: string }) {
  return <span className={`skeleton ${className}`.trim()} style={{ width: ancho, height: alto }} aria-hidden="true" />;
}

/** Tabla con encabezado y `filas` filas de `columnas` celdas (la primera más ancha). */
export function TablaCargando({ columnas = 4, filas = 6 }: { columnas?: number; filas?: number }) {
  return (
    <div className="table-wrap" aria-hidden="true">
      <table className="table">
        <thead><tr>{Array.from({ length: columnas }, (_, c) => <th key={c}><Skeleton ancho="60%" alto=".75rem" /></th>)}</tr></thead>
        <tbody>
          {Array.from({ length: filas }, (_, f) => (
            <tr key={f}>{Array.from({ length: columnas }, (_, c) => <td key={c}><Skeleton ancho={c === 0 ? "80%" : "55%"} /></td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Página en carga: título, cifras (opcional), filtros (opcional) y una o más tablas. Se anuncia a los lectores de pantalla una sola vez
 * («Cargando…») y se marca ocupada; los bloques son decorativos.
 */
export default function PaginaCargando({ tarjetas = 0, filtros = true, tablas = 1, columnas = 4, filas = 6 }: {
  tarjetas?: number; filtros?: boolean; tablas?: number; columnas?: number; filas?: number;
}) {
  return (
    <section className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      <div className="page-head"><Skeleton ancho="12rem" alto="2rem" /></div>
      {tarjetas > 0 && (
        <div className="grid gap-4 sm:grid-cols-4" aria-hidden="true">
          {Array.from({ length: tarjetas }, (_, i) => (
            <div key={i} className="card space-y-2"><Skeleton ancho="70%" alto="2.25rem" /><Skeleton ancho="50%" alto=".875rem" /></div>
          ))}
        </div>
      )}
      {filtros && (
        <div className="card" aria-hidden="true">
          <div className="form-grid form-grid-4 items-end">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className="space-y-2"><Skeleton ancho="40%" alto=".8125rem" /><Skeleton alto="2.75rem" /></div>)}
          </div>
        </div>
      )}
      {Array.from({ length: tablas }, (_, i) => <TablaCargando key={i} columnas={columnas} filas={filas} />)}
    </section>
  );
}
