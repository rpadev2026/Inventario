"use client";

/** Falla de lectura de datos: se avisa en vez de mostrar listados vacíos o stock en cero. */
export default function ErrorPagina({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="space-y-4">
      <div role="alert" className="alert">No se pudieron cargar los datos. Intente nuevamente en unos segundos.</div>
      <button onClick={reset} className="btn btn-primary">Reintentar</button>
    </section>
  );
}
