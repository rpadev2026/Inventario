import { notFound, redirect } from "next/navigation";

/** Ruta antigua: el detalle de un proveedor ahora es la vista «editar» de /proveedores. */
export default async function ProveedorAntiguoPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  redirect(`/proveedores?editar=${id}`);
}
