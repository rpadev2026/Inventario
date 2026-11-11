import { requerirAdmin } from "@/lib/auth/session";
import { aCsv } from "@/lib/csv";
import { leerFiltrosVentasFudo } from "@/lib/ventas-fudo-filtros";
import { faltantesCompleto, ventasExportables } from "@/lib/services/ventas-fudo-listado";

const chile = (iso: string) => new Date(iso).toLocaleString("sv-SE", { timeZone: "America/Santiago" }); // «2026-10-04 12:00:00»
const MOTIVO = { "sin receta": "Sin receta vinculada", "sin bodega": "La receta no tiene bodega", "descontó": "Descontó stock" } as const;

/**
 * CSV (se abre directo en Excel) de las ventas de Fudo con los mismos filtros de la pantalla (solo Administrador):
 * `?tipo=ventas` = una fila por producto vendido de cada venta; `?tipo=faltantes` = lo vendido sin descontar stock, sumado por producto.
 */
export async function GET(req: Request) {
  try {
    await requerirAdmin();
  } catch {
    return new Response("Sin acceso", { status: 403 });
  }
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const f = leerFiltrosVentasFudo(sp);
  const sufijo = [f.desde, f.hasta].filter(Boolean).join("-a-");
  try {
    let filas: (string | number | null)[][];
    let nombre: string;
    if (sp.tipo === "faltantes") {
      const r = await faltantesCompleto(f);
      nombre = "ventas-fudo-sin-descontar";
      filas = [["Producto en Fudo", "ID en Fudo", "Motivo", "Cantidad vendida"], ...r.filas.map((x) => [x.nombre, x.producto, MOTIVO[x.motivo as keyof typeof MOTIVO] ?? x.motivo, Number(x.cantidad)])];
    } else {
      const r = await ventasExportables(f);
      nombre = "ventas-fudo";
      filas = [
        ["Venta (Fudo)", "Cierre (hora de Chile)", "Producto en Fudo", "ID en Fudo", "Cantidad", "Monto", "Receta vinculada", "Stock"],
        ...r.filas.map((x) => [x.venta, chile(x.cierre), x.nombre, x.producto, Number(x.cantidad), x.monto === null ? null : Number(x.monto), x.receta ?? "", MOTIVO[x.estado]]),
      ];
      if (r.truncado) filas.push([], ["Aviso: se exportaron las primeras 50.000 líneas; acote las fechas para ver el resto."]);
    }
    return new Response(aCsv(filas), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombre}${sufijo ? `-${sufijo}` : ""}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[fudo] exportar:", (e as Error).message);
    return new Response("No se pudo generar el archivo", { status: 500 });
  }
}
