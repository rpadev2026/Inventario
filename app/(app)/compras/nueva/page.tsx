import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { cargarUnidades } from "@/lib/catalogo-nombres";
import { productosPorId, proveedoresPorId } from "../../buscar/actions";
import { tokenValido } from "@/lib/token";
import FormFactura from "./form-factura";

export default async function NuevaFacturaPage({ searchParams }: { searchParams: Promise<{ proveedor?: string; producto?: string }> }) {
  await requerirPaginaPermiso("compras.registrar");
  const { proveedor, producto } = await searchParams;
  // ?proveedor= / ?producto= traen el token del registro recién creado; cualquier otra cosa se ignora.
  const tProveedor = tokenValido(proveedor), tProducto = tokenValido(producto);
  const [{ data: rp }, { data: rd }] = await Promise.all([
    tProveedor ? db.from("Proveedores").select("IdProveedor").eq("Token", tProveedor).maybeSingle() : { data: null },
    tProducto ? db.from("Productos").select("IdProducto").eq("Token", tProducto).maybeSingle() : { data: null },
  ]);
  const idProveedor = rp?.IdProveedor, idProducto = rd?.IdProducto;
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
