// Recalcula "VentasFudoLineas"."Monto" desde Fudo (total de la línea, con el descuento de la venta repartido) para las ventas ya guardadas.
// Uso: node --env-file=.env.local scripts/corregir-montos-fudo.ts <desde AAAA-MM-DD> <hasta AAAA-MM-DD> [--aplicar]   (sin --aplicar solo muestra lo que cambiaría)
import { createClient } from "@supabase/supabase-js";

// Node no resuelve el alias "@/" de tsconfig: se traduce a la ruta real (con .ts) antes de importar el cliente de Fudo.
type Next = (s: string, c: unknown) => unknown;
const { registerHooks } = (await import("node:module")) as unknown as { registerHooks: (h: { resolve: (s: string, c: unknown, n: Next) => unknown }) => void };
registerHooks({ resolve: (spec, ctx, next) => next(spec.startsWith("@/") ? new URL(`../${spec.slice(2)}.ts`, import.meta.url).href : spec, ctx) });
const { fudo } = await import("../lib/services/fudo.ts");

const [desde, hasta, flag] = process.argv.slice(2);
const cliente = fudo();
if (!cliente || !/^\d{4}-\d{2}-\d{2}$/.test(desde ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(hasta ?? "")) { console.error("Faltan credenciales de Fudo o las fechas (AAAA-MM-DD)."); process.exit(1); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Fechas en UTC con un día de margen a cada lado; Fudo se consulta por cierre y se filtra por lo que ya existe en la base.
const diaChile = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
const ventas = (await cliente.ventasCerradas(new Date(`${desde}T00:00:00Z`), new Date(Date.parse(`${hasta}T00:00:00Z`) + 2 * 86400e3)))
  .filter((v) => diaChile(v.cierre) >= desde && diaChile(v.cierre) <= hasta);
let ventasCambiadas = 0, lineasCambiadas = 0, omitidas = 0, antes = 0, despues = 0;
for (const v of ventas) {
  const { data: filas, error } = await db.from("VentasFudoLineas").select("IdLinea,IdProductoFudo,Monto").eq("IdVentaFudo", v.id).order("IdLinea");
  if (error) throw new Error(error.message);
  if (!filas?.length) continue;
  // Las líneas se guardaron en el mismo orden y con el mismo filtro que `ventasCerradas`: se emparejan por posición y se verifica el producto.
  if (filas.length !== v.lineas.length || filas.some((f, i) => f.IdProductoFudo !== v.lineas[i].producto)) { omitidas++; console.warn(`Venta ${v.id}: no coincide con lo guardado, se omite`); continue; }
  let cambio = false;
  for (const [i, f] of filas.entries()) {
    antes += Number(f.Monto ?? 0); despues += v.lineas[i].monto ?? 0;
    if (Number(f.Monto) === v.lineas[i].monto) continue;
    cambio = true; lineasCambiadas++;
    if (flag === "--aplicar") { const { error: e } = await db.from("VentasFudoLineas").update({ Monto: v.lineas[i].monto }).eq("IdLinea", f.IdLinea); if (e) throw new Error(e.message); }
  }
  if (cambio) ventasCambiadas++;
}
console.log(`${flag === "--aplicar" ? "Aplicado" : "Simulación"}: ${ventasCambiadas} ventas / ${lineasCambiadas} líneas cambian, ${omitidas} omitidas. Monto antes ${antes}, después ${despues}.`);
