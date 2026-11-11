import { db } from "@/lib/db/supabase";
import { MSG_FUDO_CAIDO, MSG_SIN_FUDO } from "@/lib/fudo-mensajes";
import { fudo } from "./fudo";
import { sincronizarVentasCon, type ResumenSincronizacion } from "./sincronizar-ventas";

export const MSG_SIN_DESDE = "Defina FUDO_VENTAS_DESDE (fecha AAAA-MM-DD desde la que se descuentan las ventas de Fudo).";

/** Fecha de inicio de las ventas a descontar (`FUDO_VENTAS_DESDE`): evita traer todo el historial de Fudo la primera vez. */
function desdeConfigurado(): Date | null {
  const v = process.env.FUDO_VENTAS_DESDE ?? "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00-03:00`) : null; // medianoche de Chile (aprox.: sin horario de verano)
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

/** Mensaje si falta algo para sincronizar (credenciales de Fudo o fecha de inicio); null si está todo. Se revisa antes de encolar. */
export function configuracionFaltante(): string | null {
  if (!fudo()) return MSG_SIN_FUDO;
  return desdeConfigurado() ? null : MSG_SIN_DESDE;
}

/** Trae las ventas cerradas de Fudo y descuenta de las bodegas los ingredientes de las recetas vendidas (cada venta, una sola vez). */
export async function sincronizarVentas(alAvanzar?: (r: ResumenSincronizacion, total: number) => Promise<void>): Promise<{ error?: string; resumen?: ResumenSincronizacion }> {
  const falta = configuracionFaltante();
  if (falta) return { error: falta };
  const cliente = fudo()!;
  const desde = desdeConfigurado()!;
  try {
    const resumen = await sincronizarVentasCon(cliente, {
      async ultimoCierre() {
        const { data, error } = await db.from("VentasFudo").select("FechaCierre").order("FechaCierre", { ascending: false }).limit(1);
        if (error) throw new Error("No se pudo leer la última venta procesada");
        return data[0] ? new Date(data[0].FechaCierre) : null;
      },
      async procesar(v) {
        const { data, error } = await db.rpc("procesar_venta_fudo", { p_venta: v.id, p_cierre: v.cierre, p_lineas: v.lineas });
        if (error) throw new Error(error.code === "P0001" ? error.message : "error de base de datos");
        const r = data as { procesada: boolean; omitidos: unknown[] };
        return { procesada: r.procesada, omitidos: r.omitidos.length };
      },
    }, { desde, ahora: new Date(), alAvanzar });
    return { resumen };
  } catch (e) {
    console.error("[fudo] ventas:", (e as Error).message);
    return { error: MSG_FUDO_CAIDO };
  }
}
