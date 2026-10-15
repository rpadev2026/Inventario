import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { cargarUnidades } from "@/lib/catalogo-nombres";
import { productosPorId, proveedoresPorId } from "../../buscar/actions";
import FormFactura from "./form-factura";

/** Id positivo de la URL (?proveedor= / ?producto=); cualquier otra cosa se ignora. */
const idDe = (v: unknown) => (typeof v === "string" && /^\d{1,15}$/.test(v) && Number(v) > 0 ? Number(v) : undefined);

export default async function NuevaFacturaPage({ searchParams }: { searchParams: Promise<{ proveedor?: string; producto?: string }> }) {
  await requerirPaginaPermiso("compras.registrar");
  const { proveedor, producto } = await searchParams;
  const idProveedor = idDe(proveedor), idProducto = idDe(producto);
  const [{ data: formas }, unidades, provs, prods] = await Promise.all([
    db.from("FormasPago").select("Codigo,Nombre").eq("IdEstado", 1).order("Nombre"),
    cargarUnidades(),
    idProveedor ? proveedoresPorId([idProveedor]) : Promise.resolve([]),
    idProducto ? productosPorId([idProducto]) : Promise.resolve([]),
  ]);
  return (
    <section className="space-y-4">
      <h1 className="page-title">Nueva factura</h1>
      <FormFactura
        // Lo recién creado (o pedido por la URL) llega ya validado; el resto de proveedores y productos se busca en el servidor al escribir.
        provInicial={provs[0] ?? null}
        prodInicial={prods.find((p) => p.vigente) ?? null}
        unidades={unidades}
        formasPago={(formas ?? []).map((f) => ({ codigo: f.Codigo, nombre: f.Nombre }))}
      />
    </section>
  );
}
