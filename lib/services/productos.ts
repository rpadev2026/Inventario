import { db } from "../db/supabase";

/** ¿El producto ya tiene stock, facturas, solicitudes o movimientos? Entonces su unidad base no se puede cambiar. */
export async function productoTieneMovimientos(idProducto: number): Promise<boolean> {
  const tablas = ["StockBodega", "ComprasDetalle", "SolicitudesDetalle", "MovimientosBodega"] as const;
  const cuentas = await Promise.all(
    tablas.map((t) => db.from(t).select("IdProducto", { count: "exact", head: true }).eq("IdProducto", idProducto)),
  );
  return cuentas.some((c) => (c.count ?? 0) > 0);
}
