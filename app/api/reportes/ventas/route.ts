import { requerirPermiso } from "@/lib/auth/session";
import { aCsv } from "@/lib/csv";
import { etiquetaPeriodo, leerAgrupacion, leerRango } from "@/lib/reporte-ventas";
import { ventasPeriodo } from "@/lib/services/reportes";

/** CSV de las ventas por día, semana o mes con el mismo rango de la pantalla (permiso «reportes.ver»). */
export async function GET(req: Request) {
  try {
    await requerirPermiso("reportes.ver");
  } catch {
    return new Response("Sin acceso", { status: 403 });
  }
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const rango = leerRango(sp);
  const agrupar = leerAgrupacion(sp);
  let r;
  try {
    r = await ventasPeriodo(rango, agrupar);
  } catch (e) {
    console.error("[reportes] ventas por período:", (e as Error).message);
    return new Response("No se pudo generar el reporte", { status: 500 });
  }
  const filas = [
    ["Inicio del período", "Período", "Ventas", "Unidades", "Monto"],
    ...r.filas.map((f) => [f.periodo, etiquetaPeriodo(f.periodo, agrupar), f.ventas, Number(f.unidades), Number(f.monto)]),
    [],
    ["", "Total", r.ventas, Number(r.unidades), Number(r.monto)],
  ];
  return new Response(aCsv(filas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ventas-${agrupar}-${rango.desde}-${rango.hasta}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
