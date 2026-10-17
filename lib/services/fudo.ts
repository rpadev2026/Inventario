/**
 * Cliente de la API de Fudo (v1alpha1, JSON:API). Sin saber de Next ni del entorno: recibe las credenciales, `fetch` y el reloj
 * como dependencias, así se prueba con respuestas falsas (`fudo.test.ts`). `fudo()` arma el cliente real desde las variables de entorno.
 */
export type ProductoFudo = { id: string; nombre: string; codigo: string | null; precio: number; costo: number | null; activo: boolean };
export type ClienteFudo = {
  /** Productos activos cuyo nombre contiene `q` (vacío = los primeros por nombre); máximo 20. */
  buscar(q: string): Promise<ProductoFudo[]>;
  /** Productos por id de Fudo (activos o no); los que no existen se omiten. */
  porId(ids: string[]): Promise<ProductoFudo[]>;
  /** Ventas cerradas entre `desde` (incluida) y `hasta` (excluida) con sus líneas vigentes (sin las anuladas). */
  ventasCerradas(desde: Date, hasta: Date): Promise<VentaFudo[]>;
};
/** Una venta cerrada; `lineas` trae el id de Fudo del producto, la cantidad vendida y su monto (precio × cantidad; null si Fudo no lo informa). */
export type VentaFudo = { id: string; cierre: string; lineas: { producto: string; nombre: string; cantidad: number; monto: number | null }[] };
type Deps = { apiKey: string; apiSecret: string; fetch?: typeof fetch; ahora?: () => number; base?: string; auth?: string };
type Recurso = { id: string; attributes: { name: string; code?: string | null; price: number; cost?: number | null; active: boolean } };
type Respuesta = { data: any[]; included?: any[] }; // eslint-disable-line @typescript-eslint/no-explicit-any -- JSON:API genérico: se lee solo lo necesario más abajo

const PAGINA_VENTAS = 100; // las ventas traen sus líneas incluidas: páginas más chicas que el máximo de la API (500)
const MARGEN_S = 60; // se renueva el token si le quedan menos segundos

export function crearClienteFudo(d: Deps): ClienteFudo {
  const f = d.fetch ?? fetch;
  const ahora = d.ahora ?? (() => Date.now());
  const base = d.base ?? "https://api.fu.do/v1alpha1";
  const urlAuth = d.auth ?? "https://auth.fu.do/api";
  let token: { valor: string; exp: number } | null = null;

  async function autenticar(): Promise<string> {
    const r = await f(urlAuth, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ apiKey: d.apiKey, apiSecret: d.apiSecret }),
    });
    if (!r.ok) throw new Error("Fudo rechazó las credenciales de la API");
    const j = (await r.json()) as { token: string; exp: number | string };
    token = { valor: j.token, exp: Number(j.exp) }; // exp: segundos desde la Epoch (el ejemplo de la documentación lo muestra como texto)
    return token.valor;
  }
  const vigente = () => (token && token.exp - ahora() / 1000 > MARGEN_S ? token.valor : null);

  async function pedirTodo(ruta: string, reintento = true): Promise<Respuesta> {
    const t = vigente() ?? (await autenticar());
    const r = await f(`${base}${ruta}`, { headers: { Authorization: `Bearer ${t}`, Accept: "application/json" } });
    if (r.status === 401 && reintento) { token = null; return pedirTodo(ruta, false); }
    if (r.status === 429) throw new Error(`Fudo limitó las consultas: reintente en ${r.headers.get("Retry-After") ?? "unos"} segundos`);
    if (!r.ok) throw new Error(`Fudo respondió con error ${r.status}`);
    return (await r.json()) as Respuesta;
  }
  const pedir = async (ruta: string) => (await pedirTodo(ruta)).data as Recurso[];

  const aProducto = (r: Recurso): ProductoFudo => ({
    id: String(r.id), nombre: r.attributes.name, codigo: r.attributes.code ?? null,
    precio: Number(r.attributes.price), costo: r.attributes.cost == null ? null : Number(r.attributes.cost), activo: !!r.attributes.active,
  });

  return {
    async buscar(q) {
      const nombre = q.trim().slice(0, 100);
      // shortcut: se asume el comodín «*» de ilike al estilo PostgREST (la documentación solo dice «ilike.» + texto); confirmar con credenciales reales.
      const filtro = `filter[active]=eq.true${nombre ? `&filter[name]=ilike.${encodeURIComponent(`*${nombre}*`)}` : ""}`;
      return (await pedir(`/products?${filtro}&sort=name&page[size]=20&page[number]=1`)).map(aProducto);
    },
    async porId(ids) {
      const validos = [...new Set(ids)].filter((i) => /^\d{1,15}$/.test(i)).slice(0, 100);
      if (!validos.length) return [];
      return (await pedir(`/products?filter[id]=in.(${validos.join(",")})&page[size]=${validos.length}`)).map(aProducto);
    },
    async ventasCerradas(desde, hasta) {
      const ventas: VentaFudo[] = [];
      const rango = encodeURIComponent(`and(gte.${desde.toISOString()},lt.${hasta.toISOString()})`);
      for (let pagina = 1; ; pagina++) { // sin conteo total: se sigue hasta que una página venga incompleta
        const { data, included = [] } = await pedirTodo(
          `/sales?filter[saleState]=eq.CLOSED&filter[closedAt]=${rango}&include=items,items.product&sort=closedAt&page[size]=${PAGINA_VENTAS}&page[number]=${pagina}`);
        // Se busca por (tipo, id) tal como lo declara cada referencia, sin suponer cómo se llaman los tipos.
        const incluido = new Map(included.map((x) => [`${x.type}:${x.id}`, x]));
        const buscar = (ref?: { type: string; id: string }) => (ref ? incluido.get(`${ref.type}:${ref.id}`) : undefined);
        for (const v of data) {
          const lineas = ((v.relationships?.items?.data ?? []) as { type: string; id: string }[])
            .map(buscar)
            .filter((it) => it && !it.attributes?.canceled)
            .map((it) => {
              const ref = it.relationships?.product?.data;
              const producto = buscar(ref);
              const cantidad = Number(it.attributes?.quantity);
              // shortcut: se asume que `price` de la línea es el precio unitario con IVA al momento de la venta (si falta, el precio actual del
              // producto); descuentos o propinas de la venta completa no se reparten entre las líneas. Confirmar con credenciales reales.
              const crudo = it.attributes?.price ?? producto?.attributes?.price;
              const unitario = crudo == null || crudo === "" ? Number.NaN : Number(crudo);
              return {
                producto: String(ref?.id ?? ""), nombre: String(producto?.attributes?.name ?? ""), cantidad,
                monto: Number.isFinite(unitario) && unitario >= 0 ? Math.round(unitario * cantidad * 100) / 100 : null,
              };
            })
            .filter((l) => l.producto && l.cantidad > 0);
          ventas.push({ id: String(v.id), cierre: String(v.attributes.closedAt), lineas });
        }
        if (data.length < PAGINA_VENTAS) return ventas;
      }
    },
  };
}

let real: ClienteFudo | null | undefined;
/** Cliente con las credenciales del entorno (`FUDO_API_KEY`, `FUDO_API_SECRET`); null si no están definidas. */
export function fudo(): ClienteFudo | null {
  if (real === undefined) {
    const { FUDO_API_KEY: apiKey, FUDO_API_SECRET: apiSecret } = process.env;
    real = apiKey && apiSecret ? crearClienteFudo({ apiKey, apiSecret }) : null;
  }
  return real;
}
