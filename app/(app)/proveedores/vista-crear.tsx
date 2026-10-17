import Link from "next/link";
import { cargarTerritorio } from "@/lib/services/territorio";
import { FormProveedor } from "./forms";
import { href, type Contexto } from "./comun";

/** Crear: solo el formulario, con Volver. `origen` (p. ej. la factura) es la ruta a la que se vuelve, con lo recién creado elegido. */
export async function VistaCrear({ ctx, origen }: { ctx: Contexto; origen?: string }) {
  const { base, volverListado } = ctx;
  const territorio = await cargarTerritorio();
  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">Crear proveedor</h1>
        <Link href={origen ?? volverListado} className="btn btn-secondary">Volver</Link>
      </div>
      <div className="card">
        <FormProveedor territorio={territorio} volver={origen} despuesDeGuardar={href({ tam: base.tam, aviso: "creado" })} />
      </div>
    </section>
  );
}
