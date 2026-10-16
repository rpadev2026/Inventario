import { notFound, redirect } from "next/navigation";
import { tokenValido } from "@/lib/token";

/** Ruta antigua: el detalle de un proveedor ahora es la vista «editar» de /proveedores. */
export default async function ProveedorAntiguoPage({ params }: { params: Promise<{ id: string }> }) {
  const token = tokenValido((await params).id);
  if (!token) notFound();
  redirect(`/proveedores?editar=${token}`);
}
