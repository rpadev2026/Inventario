/**
 * Filtros de los listados que no se ven en la URL: `proxy.ts` los guarda en una cookie de sesión (un valor por ruta),
 * deja la URL limpia (redirige) y, cuando la página se pide sin ellos, se los agrega por debajo (rewrite) para que
 * las páginas sigan leyendo `searchParams` como siempre. Las vistas (`ver`, `editar`, `aviso`...) y las subpaginaciones
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
  /** La URL traía filtros: se guardan y se redirige a `limpia` (la misma ruta con el resto de parámetros). */
  redirigir: boolean;
  /** Búsqueda sin los filtros (para el redirect). */
  limpia: string;
  /** Búsqueda que debe ver la página: la de la URL más los filtros guardados. */
  efectiva: string;
  /** Cookie nueva (JSON) si hay que escribirla; undefined si no cambia. */
  cookie: string | null | undefined;
};

/** Decide qué hacer con una petición GET de `ruta?search` dado el contenido de la cookie. */
export function resolverFiltros(ruta: string, search: string, cookie: string | undefined): Resolucion {
  const params = new URLSearchParams(search);
  const guardado = leerGuardado(cookie);
  const previo = guardado[ruta] ?? {};
  const enUrl = [...params.keys()].filter(esFiltro);

  if (enUrl.length === 0) {
    const efectiva = new URLSearchParams(params);
    for (const [k, v] of Object.entries(previo)) efectiva.set(k, v);
    return { redirigir: false, limpia: params.toString(), efectiva: efectiva.toString(), cookie: undefined };
  }

  const nuevo: Record<string, string> = { ...previo };
  const resto = new URLSearchParams();
  for (const [k, v] of params) {
    if (!esFiltro(k)) { resto.append(k, v); continue; }
    if (v === "") delete nuevo[k];
    else if (v.length <= MAX_VALOR) nuevo[k] = v;
  }
  const todo: Guardado = { ...guardado };
  if (Object.keys(nuevo).length) todo[ruta] = nuevo; else delete todo[ruta];
  let json = JSON.stringify(todo);
  if (json.length > MAX_COOKIE) { delete todo[ruta]; json = JSON.stringify(todo); } // no cabe: ese listado no recuerda
  return { redirigir: true, limpia: resto.toString(), efectiva: "", cookie: Object.keys(todo).length ? json : null };
}
