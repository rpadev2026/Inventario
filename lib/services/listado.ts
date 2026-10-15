import "server-only";
import { db } from "@/lib/db/supabase";
import { paginar, type Paginacion } from "@/lib/paginacion";

type Tabla = "productos" | "usuarios" | "bodegas" | "recetas" | "proveedores";

/** Una página de un listado filtrado y ordenado en la base (RPC `listar_pagina`); el total sale del mismo filtro. */
export async function listarPagina<T>(
  tabla: Tabla,
  f: { q?: string; estado?: 0 | 1; pagina?: unknown; tam?: unknown },
): Promise<{ filas: T[]; pg: Paginacion }> {
  const pedir = async (off: number, lim: number) => {
    const { data, error } = await db.rpc("listar_pagina", { p_tabla: tabla, p_q: f.q ?? "", p_estado: f.estado ?? null, p_off: off, p_lim: lim });
    if (error || !data) throw new Error(`No se pudo cargar el listado de ${tabla}`);
    return data as { total: number; filas: T[] };
  };
  // Primero la página pedida; si cae fuera del total (p. ej. filtro nuevo) se corrige y se vuelve a pedir.
  const tentativa = paginar(f, Number.MAX_SAFE_INTEGER);
  let r = await pedir(tentativa.from, tentativa.tam);
  let pg = paginar(f, Number(r.total));
  if (pg.from !== tentativa.from) r = await pedir(pg.from, pg.tam);
  return { filas: r.filas, pg };
}
