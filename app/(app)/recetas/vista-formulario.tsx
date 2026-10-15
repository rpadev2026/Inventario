import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { opcionProducto, opcionSubreceta } from "@/lib/opciones-remotas";
import { productosPorId, subrecetasPorId } from "../buscar/actions";
import FormReceta, { type LineaForm } from "./form";
import { href, type Contexto, type RecetaRow } from "./comun";

/** Crear o editar: solo el formulario, con Volver. `rec` es la receta a editar (null al crear). */
export async function VistaFormulario({ ctx, crear, idEditar, rec }: { ctx: Contexto; crear: boolean; idEditar?: number; rec: RecetaRow | null }) {
  const { base, volverListado, unidades } = ctx;
  const { data: dets } = idEditar
    ? await db.from("RecetaDetalles").select("IdProducto,IdSubReceta,Cantidad,PorcionNeta,UnidadMedida,PorcentajeMerma").eq("IdReceta", idEditar).order("IdDetalle")
    : { data: [] };
  // Solo los ingredientes de las líneas guardadas (vigentes o no, para que la línea no quede en blanco); el resto se busca en el servidor al escribir.
  const idsProductos = [...new Set((dets ?? []).filter((d) => d.IdProducto !== null).map((d) => d.IdProducto as number))];
  const idsSubrecetas = [...new Set((dets ?? []).filter((d) => d.IdSubReceta !== null).map((d) => d.IdSubReceta as number))];
  const [productosLineas, subrecetasLineas] = await Promise.all([productosPorId(idsProductos), subrecetasPorId(idsSubrecetas)]);
  const productosIniciales = productosLineas.map(opcionProducto);
  const subrecetasIniciales = subrecetasLineas.map(opcionSubreceta);
  const lineas: LineaForm[] = (dets ?? []).map((d) => ({
    tipo: d.IdProducto !== null ? "producto" : "subreceta", ingrediente: String(d.IdProducto ?? d.IdSubReceta),
    cantidad: String(Number(d.Cantidad)), porcion: String(Number(d.PorcionNeta)), unidad: d.UnidadMedida,
    merma: Number(d.PorcentajeMerma) === 0 ? "" : String(Math.round(Number(d.PorcentajeMerma) * 10000) / 100),
  }));
  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">{crear ? "Crear receta" : "Editar receta"}</h1>
        <Link href={volverListado} className="btn btn-secondary">Volver</Link>
      </div>
      <div className="card">
        <FormReceta
          key={idEditar ?? "nueva"} productosIniciales={productosIniciales} subrecetasIniciales={subrecetasIniciales} unidades={unidades} lineas={lineas}
          receta={rec ? {
            id: rec.IdReceta, codigo: rec.CodigoReceta, nombre: rec.Nombre, porciones: Number(rec.RendimientoPorciones),
            rendimientoCantidad: rec.RendimientoCantidad === null ? null : Number(rec.RendimientoCantidad),
            rendimientoUnidad: rec.RendimientoUnidad, estado: rec.IdEstado,
          } : undefined}
          despuesDeGuardar={href({ ...(crear ? { tam: base.tam } : base), aviso: crear ? "creado" : "editado" })}
        />
      </div>
    </section>
  );
}
