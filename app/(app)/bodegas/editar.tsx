"use client";
import { useRouter } from "next/navigation";
import FormBodega from "./form";

type Bodega = { IdBodega: number; NombreBodega: string; IdEstado: number; EsCentral: boolean };

/** Formulario de edición: al guardar vuelve al listado (`volverHref` conserva página, filtros y muestra el aviso). */
export function EditarBodega({ b, volverHref }: { b: Bodega; volverHref: string }) {
  const router = useRouter();
  return <FormBodega b={b} onGuardado={() => router.push(volverHref)} />;
}

/** Formulario de creación: al crear vuelve al listado con el aviso. */
export function CrearBodega({ volverHref }: { volverHref: string }) {
  const router = useRouter();
  return <FormBodega onGuardado={() => router.push(volverHref)} />;
}
