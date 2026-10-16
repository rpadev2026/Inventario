import Link from "next/link";

/** Ruta o registro inexistente (también lo usa notFound() en las páginas de detalle). */
export default function NoEncontrada() {
  return (
    <main className="mx-auto max-w-md space-y-4 p-8 text-center">
      <h1 className="page-title">Página no encontrada</h1>
      <p className="text-muted">El enlace no existe o el registro ya no está disponible.</p>
      <Link href="/" className="btn btn-primary">Ir al inicio</Link>
    </main>
  );
}
