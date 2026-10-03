/** Tamaños de página permitidos y valor por defecto. */
export const TAMANOS = [10, 25, 50, 75, 100] as const;
export const TAM_DEFECTO = 10;

export type Paginacion = {
  pagina: number; tam: number; total: number; totalPaginas: number;
  /** Posición (1-based) del primer y último registro visible; 0 y 0 si no hay registros. */
  desde: number; hasta: number;
  /** Rango (0-based, ambos inclusivos) para `.range(from, to)` de Supabase. */
  from: number; to: number;
};

/** Entero positivo escrito como texto/número en la URL; cualquier otra cosa (decimales, signos, listas) es inválida. */
function entero(v: unknown): number | undefined {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  return /^\d+$/.test(s) ? Number(s) : undefined;
}

/** Normaliza página y tamaño pedidos (p. ej. desde searchParams) y calcula el rango a consultar. */
export function paginar(entrada: { pagina?: unknown; tam?: unknown }, total: number): Paginacion {
  const t = entero(entrada.tam);
  const tam = (TAMANOS as readonly number[]).includes(t ?? -1) ? (t as number) : TAM_DEFECTO;
  const totalPaginas = Math.max(1, Math.ceil(total / tam));
  const pagina = Math.min(Math.max(entero(entrada.pagina) ?? 1, 1), totalPaginas);
  const from = (pagina - 1) * tam;
  return {
    pagina, tam, total, totalPaginas, from, to: from + tam - 1,
    desde: total === 0 ? 0 : from + 1, hasta: Math.min(from + tam, total),
  };
}
