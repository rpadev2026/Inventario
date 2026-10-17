/**
 * Filtros de los listados que no se ven en la URL: `proxy.ts` los guarda en una cookie de sesión (un valor por ruta) y
 * siempre le entrega a la página los de la URL combinados con los guardados (rewrite), así las páginas siguen leyendo
 * `searchParams` como siempre. NO redirige (Next maneja mal una redirección en una navegación interna): la URL visible la
 * limpia `components/app/limpiar-url.tsx` en el navegador. Las vistas (`ver`, `editar`, `aviso`...) y las subpaginaciones
 * (`ppagina`, `hpagina`...) NO son filtros y siguen en la URL.
 *
 * Un filtro que llega con valor vacío (`?q=`) borra el guardado: así se limpian los filtros y se vuelve a la página 1.
 */
export const COOKIE_FILTROS = "filtros";
export const FILTRO_KEYS = ["pagina", "tam", "q", "estado", "solicitante", "desde", "hasta", "agrupar", "con_stock", "bodega"] as const;
const ES_FILTRO = new Set<string>(FILTRO_KEYS);
export const esFiltro = (k: string) => ES_FILTRO.has(k);

const MAX_COOKIE = 3500;
const MAX_VALOR = 200;

type Guardado = Record<string, Record<string, string>>;

/** Lee la cookie sin confiar en ella: solo claves de filtro conocidas, valores de texto acotados. */
export function leerGuardado(crudo: string | undefined): Guardado {
  const out: Guardado = {};
  if (!crudo) return out;
  let j: unknown;
  try { j = JSON.parse(crudo); } catch { return out; }
  if (!j || typeof j !== "object" || Array.isArray(j)) return out;
  for (const [ruta, v] of Object.entries(j as Record<string, unknown>)) {
    if (!ruta.startsWith("/") || !v || typeof v !== "object" || Array.isArray(v)) continue;
    const f: Record<string, string> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (esFiltro(k) && typeof x === "string" && x !== "" && x.length <= MAX_VALOR) f[k] = x;
    }
    if (Object.keys(f).length) out[ruta] = f;
  }
  return out;
}

export type Resolucion = {
  /** Búsqueda que debe ver la página: lo que no es filtro de la URL, más los filtros guardados combinados con los de la URL. */
  efectiva: string;
  /** Cookie nueva (JSON) si hay que escribirla; null = borrarla; undefined = no cambia. */
  cookie: string | null | undefined;
};

/** Decide qué ve la página y qué se guarda para una petición GET de `ruta?search`, dado el contenido de la cookie. */
export function resolverFiltros(ruta: string, search: string, cookie: string | undefined): Resolucion {
  const params = new URLSearchParams(search);
  const guardado = leerGuardado(cookie);
  const previo = guardado[ruta] ?? {};
  const hayEnUrl = [...params.keys()].some(esFiltro);

  // Los filtros de la URL pisan a los guardados; uno vacío borra el guardado.
  const vigentes: Record<string, string> = { ...previo };
  const efectiva = new URLSearchParams();
  for (const [k, v] of params) {
    if (!esFiltro(k)) { efectiva.append(k, v); continue; }
    if (v === "") delete vigentes[k];
    else if (v.length <= MAX_VALOR) vigentes[k] = v;
  }
  for (const [k, v] of Object.entries(vigentes)) efectiva.set(k, v);
  if (!hayEnUrl) return { efectiva: efectiva.toString(), cookie: undefined };

  const todo: Guardado = { ...guardado };
  if (Object.keys(vigentes).length) todo[ruta] = vigentes; else delete todo[ruta];
  let json = JSON.stringify(todo);
  if (json.length > MAX_COOKIE) { delete todo[ruta]; json = JSON.stringify(todo); } // no cabe: ese listado no recuerda
  return { efectiva: efectiva.toString(), cookie: Object.keys(todo).length ? json : null };
}
