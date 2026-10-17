import { requerirPermiso } from "@/lib/auth/session";
import { aCsv } from "@/lib/csv";
import { leerRango } from "@/lib/reporte-ventas";
import { ventasProductoCompleto } from "@/lib/services/reportes";

/** CSV del resumen de ventas por producto con el mismo rango y filtro de la pantalla (permiso «reportes.ver»). */
export async function GET(req: Request) {
  try {
    await requerirPermiso("reportes.ver");
  } catch {
    return new Response("Sin acceso", { status: 403 });
  }
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const rango = leerRango(sp);
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  let r;
  try {
    r = await ventasProductoCompleto(rango, q);
  } catch (e) {
    console.error("[reportes] ventas por producto:", (e as Error).message);
    return new Response("No se pudo generar el reporte", { status: 500 });
  }
  const filas = [
    ["Producto (Fudo)", "Receta vinculada", "Unidades", "Ventas", "Monto"],
    ...r.filas.map((f) => [f.producto, f.receta ?? "", Number(f.unidades), f.ventas, f.monto === null ? "" : Number(f.monto)]),
    [],
    ["Total", "", Number(r.unidades), r.ventas, Number(r.monto)],
  ];
  return new Response(aCsv(filas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ventas-por-producto-${rango.desde}-${rango.hasta}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
