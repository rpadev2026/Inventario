import Link from "next/link";
import { cargarTerritorio } from "@/lib/services/territorio";
import { FormProveedor } from "./forms";
import { href, type Contexto } from "./comun";

/** Crear: solo el formulario, con Volver (a la factura si se vino de ella). */
export async function VistaCrear({ ctx }: { ctx: Contexto }) {
  const { base, volverListado, rutaVolver } = ctx;
  const territorio = await cargarTerritorio();
  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">Crear proveedor</h1>
        <Link href={rutaVolver ?? volverListado} className="btn btn-secondary">Volver</Link>
      </div>
      <div className="card">
        <FormProveedor territorio={territorio} volver={rutaVolver ?? undefined} despuesDeGuardar={href({ tam: base.tam, aviso: "creado" })} />
      </div>
    </section>
  );
}
