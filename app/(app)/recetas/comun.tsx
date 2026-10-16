import { db } from "@/lib/db/supabase";
import type { Database } from "@/lib/db/tipos";
import type { UnidadInfo } from "@/lib/unidades";

/** Lo que comparten las vistas de /recetas (listado, detalle y formulario): se calcula una vez en page.tsx. */
export type Params = Record<string, string | string[] | undefined>;
export type Contexto = {
  sp: Params;
  /** Página, tamaño y filtros del listado: se conservan al ir a una vista y volver. */
  base: { pagina?: string; tam?: string; q?: string; estado?: string };
  volverListado: string;
  puedeGestionar: boolean;
  unidades: UnidadInfo[];
  nombreUnidad: Map<string, string>;
};
export type RecetaRow = Database["public"]["Tables"]["Recetas"]["Row"];

export type Calculo = {
  total: number; porcion: number; incompleto: boolean; costoPorBase: number | null;
  lineas: { detalle: number; tipo: "producto" | "subreceta"; id: number; nombre: string; cantidadBruta: number; unidad: string; costo: number | null; sinCosto: boolean }[];
};
/** Costos de varias recetas en una sola llamada (sin las líneas), por id. */
type Resumen = Omit<Calculo, "lineas">;

export const texto = (v: string | string[] | undefined) => (typeof v === "string" && v !== "" ? v : undefined);
export const AVISOS: Record<string, string> = { creado: "Receta creada correctamente", editado: "Cambios guardados correctamente" };

const clpEntero = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const clpDecimal = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Costo en pesos: sin decimales si es entero («$2.500»), con dos si no («$3.500,50»). */
export const clp = (n: number) => (Number.isInteger(n) ? clpEntero : clpDecimal).format(n);
export const num = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 4 });

/** URL de /recetas con solo los parámetros indicados (los undefined se omiten). */
export function href(q: Record<string, string | undefined>) {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined) as [string, string][]).toString();
  return s ? `/recetas?${s}` : "/recetas";
}

export const Dato = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div><div className="label-block">{titulo}</div><div>{children || "—"}</div></div>
);

export const calcular = async (id: number): Promise<Calculo | null> => {
  const { data } = await db.rpc("calcular_receta", { p_receta: id });
  return (data as Calculo | null) ?? null;
};
export const calcularVarias = async (ids: number[]): Promise<Record<string, Resumen>> => {
  if (!ids.length) return {};
  const { data } = await db.rpc("calcular_recetas", { p_ids: ids });
  return (data as Record<string, Resumen> | null) ?? {};
};
