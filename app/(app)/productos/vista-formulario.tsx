import Link from "next/link";
import { productoTieneMovimientos } from "@/lib/services/productos";
import FormProducto, { type Producto } from "./form";
import { href, recetasQueUsan, type Contexto } from "./comun";

/** Crear: solo el formulario, con Volver. `origen` (p. ej. la factura) es la ruta a la que se vuelve, con lo recién creado elegido. */
export function VistaCrear({ ctx, origen }: { ctx: Contexto; origen?: string }) {
  const { base, volverListado, unidades, formatos } = ctx;
  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">Crear producto</h1>
        <Link href={origen ?? volverListado} className="btn btn-secondary">Volver</Link>
      </div>
      <div className="card">
        <FormProducto unidades={unidades} formatos={formatos} volver={origen} despuesDeGuardar={href({ tam: base.tam, aviso: "creado" })} />
      </div>
    </section>
  );
}

/** Editar: solo el formulario del producto, con Volver. */
export async function VistaEditar({ ctx, sel }: { ctx: Contexto; sel: Producto }) {
  const { base, volverListado, unidades, formatos } = ctx;
  const [bloqueada, enRecetas] = await Promise.all([productoTieneMovimientos(sel.IdProducto), recetasQueUsan(sel.IdProducto)]);
  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">Editar producto</h1>
        <Link href={volverListado} className="btn btn-secondary">Volver</Link>
      </div>
      <div className="card">
        <FormProducto key={sel.IdProducto} p={sel} unidades={unidades} formatos={formatos} unidadBaseBloqueada={bloqueada} enRecetas={enRecetas} despuesDeGuardar={href({ ...base, aviso: "editado" })} />
      </div>
    </section>
  );
}
