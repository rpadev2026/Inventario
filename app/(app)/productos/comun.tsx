import { db } from "@/lib/db/supabase";
import type { cargarCatalogo } from "@/lib/catalogo-nombres";
import type { UnidadInfo } from "@/lib/unidades";

/** Lo que comparten las vistas de /productos (listado, detalle, crear y editar): se calcula una vez en page.tsx. */
export type Params = Record<string, string | string[] | undefined>;
export type Contexto = {
  sp: Params;
  /** Página, tamaño y filtros del listado: se conservan al ir a una vista y volver. */
  base: { pagina?: string; tam?: string; q?: string; estado?: string };
  volverListado: string;
  /** Ruta a la que se vuelve tras crear (la factura), ya validada; null si no se vino de ella. */
  rutaVolver: string | null;
  puedeGestionar: boolean;
  puedeVerCompras: boolean;
  unidades: UnidadInfo[];
  formatos: Awaited<ReturnType<typeof cargarCatalogo>>;
  nombreUnidad: Map<string, string>;
  nombreFormato: Map<string, string>;
};

export const texto = (v: string | string[] | undefined) => (typeof v === "string" && v !== "" ? v : undefined);
export const tono = { Crítico: "danger", Bajo: "warn", OK: "ok" } as const;
export const AVISOS: Record<string, string> = { creado: "Producto creado correctamente", editado: "Cambios guardados correctamente" };

const clpEntero = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const clpDecimal = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Precio en pesos: sin decimales si es entero («$2.500»), con dos si no («$3.500,50»). */
export const clp = { format: (n: number) => (Number.isInteger(n) ? clpEntero : clpDecimal).format(n) };
export const clpBase = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 6 });
export const fecha = (iso: string) => new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });

/** URL de /productos con solo los parámetros indicados (los undefined se omiten). */
export function href(q: Record<string, string | undefined>) {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined) as [string, string][]).toString();
  return s ? `/productos?${s}` : "/productos";
}

export const Dato = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div><div className="label-block">{titulo}</div><div>{children || "—"}</div></div>
);

/** Cuántas recetas (distintas) usan el producto como ingrediente. */
export async function recetasQueUsan(idProducto: number): Promise<number> {
  const { data } = await db.from("RecetaDetalles").select("IdReceta").eq("IdProducto", idProducto);
  return new Set((data ?? []).map((d) => d.IdReceta as number)).size;
}
