import { requerirPermiso } from "@/lib/auth/session";
import { aCsv } from "@/lib/csv";
import { leerFiltrosStock } from "@/lib/reporte-stock";
import { stockCompleto } from "@/lib/services/reportes";

/** CSV del reporte de stock valorizado con los mismos filtros de la pantalla (permiso «reportes.ver»). */
export async function GET(req: Request) {
  try {
    await requerirPermiso("reportes.ver");
  } catch {
    return new Response("Sin acceso", { status: 403 });
  }
  const f = leerFiltrosStock(Object.fromEntries(new URL(req.url).searchParams));
  let reporte;
  try {
    reporte = await stockCompleto(f);
  } catch (e) {
    console.error("[reportes] stock:", (e as Error).message);
    return new Response("No se pudo generar el reporte", { status: 500 });
  }
  const filas = [
    ["Código", "Producto", "Bodega", "Cantidad", "Unidad", "Costo unitario (con IVA)", "Valor"],
    ...reporte.filas.map((r) => [r.codigo ?? "", r.producto, r.bodega, Number(r.cantidad), r.unidad, r.costo === null ? "" : Number(r.costo), r.valor === null ? "" : Number(r.valor)]),
    [],
    ["", "", "", "", "", "Valor total", Number(reporte.valorTotal)],
  ];
  const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Santiago" }); // AAAA-MM-DD
  return new Response(aCsv(filas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stock-valorizado-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
