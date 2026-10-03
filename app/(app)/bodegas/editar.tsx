"use client";
import { useRouter } from "next/navigation";
import FormBodega from "./form";

/** Formulario de edición de una bodega: al guardar vuelve al listado (`volverHref` conserva la página). */
export default function EditarBodega({ b, volverHref }: {
  b: { IdBodega: number; NombreBodega: string; IdEstado: number; EsCentral: boolean }; volverHref: string;
}) {
  const router = useRouter();
  return <FormBodega b={b} cancelarHref={volverHref} onGuardado={() => router.push(volverHref)} />;
}
