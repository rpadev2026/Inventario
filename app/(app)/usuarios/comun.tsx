import { db } from "@/lib/db/supabase";
import type { Database } from "@/lib/db/tipos";
import Badge from "@/components/app/badge";

/** Lo que comparten las vistas de /usuarios (listado, detalle, crear y editar): se calcula una vez en page.tsx. */
export type Params = Record<string, string | string[] | undefined>;
export type RolVigente = { IdRol: number; NombreRol: string };
export type Contexto = {
  sp: Params;
  /** Página, tamaño y filtros del listado: se conservan al ir a una vista y volver. */
  base: { pagina?: string; tam?: string; q?: string; estado?: string };
  volverListado: string;
  /** Usuario que está viendo la pantalla (no puede desactivarse ni quitarse el rol Administrador). */
  uidActual: number;
  roles: RolVigente[];
};
/** Columnas del usuario que usan las vistas de detalle y edición. */
export type UsuarioSel = Pick<Database["public"]["Tables"]["Usuarios"]["Row"], "IdUsuario" | "Rut" | "Nombres" | "Apellidos" | "Correo" | "IdEstado" | "FechaRegistroCreacion">;

export const entero = (v: unknown) => (typeof v === "string" && /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : undefined);
export const texto = (v: string | string[] | undefined) => (typeof v === "string" && v !== "" ? v : undefined);
export const AVISOS: Record<string, string> = {
  creado: "Usuario creado correctamente. Deberá cambiar su clave al ingresar.",
  editado: "Cambios guardados correctamente",
};
export const estadoBadge = (e: number) => <Badge tone={e === 1 ? "ok" : "neutral"}>{e === 1 ? "Vigente" : "No vigente"}</Badge>;

/** URL de /usuarios con solo los parámetros indicados (los undefined se omiten). */
export function href(q: Record<string, string | undefined>) {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined) as [string, string][]).toString();
  return s ? `/usuarios?${s}` : "/usuarios";
}

export const Dato = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div><div className="label-block">{titulo}</div><div>{children || "—"}</div></div>
);

/** Roles vigentes de un usuario, separados en asignados y disponibles (para Ver y Editar). */
export async function rolesDe(roles: RolVigente[], id: number) {
  const { data } = await db.from("UsuariosRoles").select("IdRol").eq("IdUsuario", id).eq("IdEstado", 1);
  const asignados = new Set((data ?? []).map((r) => r.IdRol));
  return { asignados: roles.filter((r) => asignados.has(r.IdRol)), disponibles: roles.filter((r) => !asignados.has(r.IdRol)) };
}
