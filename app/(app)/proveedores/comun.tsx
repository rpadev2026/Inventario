import Badge from "@/components/app/badge";
import type { cargarTerritorio } from "@/lib/services/territorio";

/** Lo que comparten las vistas de /proveedores (listado, detalle, crear y editar): se calcula una vez en page.tsx. */
export type Params = Record<string, string | string[] | undefined>;
export type Contexto = {
  sp: Params;
  /** Página, tamaño y filtros del listado: se conservan al ir a una vista y volver. */
  base: { pagina?: string; tam?: string; q?: string; estado?: string };
  volverListado: string;
  /** Ruta a la que se vuelve tras crear (la factura), ya validada; null si no se vino de ella. */
  rutaVolver: string | null;
  puedeGestionar: boolean;
};
export type Territorio = Awaited<ReturnType<typeof cargarTerritorio>>;

export const entero = (v: unknown) => (typeof v === "string" && /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : undefined);
export const texto = (v: string | string[] | undefined) => (typeof v === "string" && v !== "" ? v : undefined);
export const AVISOS: Record<string, string> = {
  creado: "Proveedor creado correctamente", editado: "Cambios guardados correctamente",
  "sucursal-creada": "Sucursal creada correctamente", "sucursal-editada": "Sucursal guardada correctamente",
  "vendedor-creado": "Vendedor creado correctamente", "vendedor-editado": "Vendedor guardado correctamente",
};
export const estadoBadge = (e: number) => <Badge tone={e === 1 ? "ok" : "neutral"}>{e === 1 ? "Vigente" : "No vigente"}</Badge>;

/** URL de /proveedores con solo los parámetros indicados (los undefined se omiten). */
export function href(q: Record<string, string | undefined>) {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined) as [string, string][]).toString();
  return s ? `/proveedores?${s}` : "/proveedores";
}

/** Funciones que traducen código → nombre de región, ciudad (provincia) y comuna. */
export function nombresTerritorio(t: Territorio) {
  const nombre = (lista: { Codigo: string; Nombre: string }[], c: string | null) => (c ? lista.find((x) => x.Codigo === c)?.Nombre ?? c : "");
  return { region: (c: string | null) => nombre(t.regiones, c), ciudad: (c: string | null) => nombre(t.ciudades, c), comuna: (c: string | null) => nombre(t.comunas, c) };
}

export const Dato = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div><div className="label-block">{titulo}</div><div>{children || "—"}</div></div>
);
