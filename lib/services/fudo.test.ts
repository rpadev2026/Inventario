import { describe, it, expect } from "vitest";
import { crearClienteFudo } from "./fudo";

const recurso = (id: number, name: string, price: number, extra = {}) => ({ id: String(id), type: "Product", attributes: { name, price, active: true, ...extra } });

/** Servidor falso: registra las llamadas y responde con lo que se le programe. */
function falso(opciones: { productos?: unknown[]; estados?: number[]; exp?: number } = {}) {
  const llamadas: { url: string; auth?: string }[] = [];
  const tokens = ["t1", "t2", "t3"];
  const estados = [...(opciones.estados ?? [])];
  let reloj = 1_000_000; // segundos
  const fetchFalso = (async (url: string, init?: RequestInit) => {
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    llamadas.push({ url, auth });
    if (url.includes("auth.fu.do")) return new Response(JSON.stringify({ token: tokens.shift(), exp: String(reloj + (opciones.exp ?? 86400)) }), { status: 200 });
    const estado = estados.shift() ?? 200;
    if (estado === 429) return new Response("espere", { status: 429, headers: { "Retry-After": "7" } });
    if (estado !== 200) return new Response("", { status: estado });
    return new Response(JSON.stringify({ data: opciones.productos ?? [] }), { status: 200 });
  }) as unknown as typeof fetch;
  const cliente = crearClienteFudo({ apiKey: "k", apiSecret: "s", fetch: fetchFalso, ahora: () => reloj * 1000 });
  return { cliente, llamadas, avanzar: (s: number) => { reloj += s; } };
}
const autenticaciones = (l: { url: string }[]) => l.filter((x) => x.url.includes("auth.fu.do")).length;

const venta = (id: number, items: { id: number; q: number; producto: number; canceled?: boolean }[]) => ({
  id: String(id), type: "Sale", attributes: { closedAt: "2026-10-15T20:00:00Z", saleState: "CLOSED" },
  relationships: { items: { data: items.map((i) => ({ id: String(i.id), type: "Item" })) } },
});
const item = (id: number, producto: number, quantity: number, canceled = false, price?: number) => ({
  id: String(id), type: "Item", attributes: { quantity, canceled, ...(price === undefined ? {} : { price }) }, relationships: { product: { data: { id: String(producto), type: "Product" } } },
});
const prod = (id: number, name: string, price?: number) => ({ id: String(id), type: "Product", attributes: { name, ...(price === undefined ? {} : { price }) } });

/** Servidor falso de ventas: devuelve las páginas programadas, en orden. */
function ventasFalso(paginas: { data: unknown[]; included?: unknown[] }[]) {
  const urls: string[] = [];
  const fetchFalso = (async (url: string) => {
    urls.push(decodeURIComponent(url));
    if (url.includes("auth.fu.do")) return new Response(JSON.stringify({ token: "t", exp: "9999999999" }), { status: 200 });
    return new Response(JSON.stringify(paginas.shift() ?? { data: [] }), { status: 200 });
  }) as unknown as typeof fetch;
  return { cliente: crearClienteFudo({ apiKey: "k", apiSecret: "s", fetch: fetchFalso }), urls };
}

describe("ventas cerradas de Fudo", () => {
  it("arma el filtro por estado y rango de cierre, y trae las líneas con su producto (sin las anuladas)", async () => {
    const { cliente, urls } = ventasFalso([{
      data: [venta(1, [{ id: 11, q: 2, producto: 5 }, { id: 12, q: 1, producto: 6 }, { id: 13, q: 1, producto: 5 }])],
      included: [item(11, 5, 2, false, 9000), item(12, 6, 1, true), item(13, 5, 1), prod(5, "Pizza", 9990), prod(6, "Café")],
    }]);
    const r = await cliente.ventasCerradas(new Date("2026-10-15T00:00:00Z"), new Date("2026-10-16T00:00:00Z"));
    expect(urls.at(-1)).toContain("filter[saleState]=eq.CLOSED&filter[closedAt]=and(gte.2026-10-15T00:00:00.000Z,lt.2026-10-16T00:00:00.000Z)");
    expect(urls.at(-1)).toContain("include=items,items.product");
    expect(r).toEqual([{ id: "1", cierre: "2026-10-15T20:00:00Z", lineas: [{ producto: "5", nombre: "Pizza", cantidad: 2, monto: 18000 }, { producto: "5", nombre: "Pizza", cantidad: 1, monto: 9990 }] }]);
  });
  it("el monto es precio × cantidad (el de la línea; si falta, el del producto) y null si no hay ningún precio", async () => {
    const { cliente } = ventasFalso([{
      data: [venta(1, [{ id: 21, q: 3, producto: 7 }, { id: 22, q: 1, producto: 8 }, { id: 23, q: 2, producto: 9 }])],
      included: [item(21, 7, 3, false, 1500.5), item(22, 8, 1), item(23, 9, 2), prod(7, "Bebida", 1000), prod(8, "Papas", 2500), prod(9, "Regalo")],
    }]);
    const [v] = await cliente.ventasCerradas(new Date(0), new Date());
    expect(v.lineas.map((l) => l.monto)).toEqual([4501.5, 2500, null]);
  });
  it("pagina hasta que una página viene incompleta", async () => {
    const llena = Array.from({ length: 100 }, (_, i) => venta(i + 1, []));
    const { cliente, urls } = ventasFalso([{ data: llena }, { data: [venta(101, [])] }]);
    const r = await cliente.ventasCerradas(new Date(0), new Date());
    expect(r).toHaveLength(101);
    expect(urls.filter((u) => u.includes("/sales?"))).toHaveLength(2);
    expect(urls.at(-1)).toContain("page[number]=2");
  });
});

describe("cliente de Fudo", () => {
  it("autentica una vez y reutiliza el token", async () => {
    const { cliente, llamadas } = falso({ productos: [recurso(1, "Pizza", 9990)] });
    await cliente.buscar("pizza"); await cliente.buscar("pizza");
    expect(autenticaciones(llamadas)).toBe(1);
    expect(llamadas.at(-1)?.auth).toBe("Bearer t1");
  });
  it("renueva el token cuando está por vencer", async () => {
    const { cliente, llamadas, avanzar } = falso({ exp: 3600 });
    await cliente.buscar(""); avanzar(3600 - 30);
    await cliente.buscar("");
    expect(autenticaciones(llamadas)).toBe(2);
    expect(llamadas.at(-1)?.auth).toBe("Bearer t2");
  });
  it("ante un 401 pide un token nuevo y reintenta una vez", async () => {
    const { cliente, llamadas } = falso({ estados: [401, 200], productos: [recurso(2, "Café", 1500)] });
    expect(await cliente.buscar("")).toHaveLength(1);
    expect(llamadas.at(-1)?.auth).toBe("Bearer t2");
  });
  it("arma la búsqueda por nombre (solo activos) y mapea el producto", async () => {
    const { cliente, llamadas } = falso({ productos: [recurso(5, "Pizza Napolitana", 9990, { code: "PZ1", cost: 3000 })] });
    const r = await cliente.buscar("  pizza ");
    expect(decodeURIComponent(llamadas.at(-1)!.url)).toContain("filter[active]=eq.true&filter[name]=ilike.*pizza*");
    expect(r).toEqual([{ id: "5", nombre: "Pizza Napolitana", codigo: "PZ1", precio: 9990, costo: 3000, activo: true }]);
  });
  it("por id: ignora ids que no son numéricos y no consulta si no queda ninguno", async () => {
    const { cliente, llamadas } = falso({ productos: [recurso(7, "Té", 1000)] });
    expect(await cliente.porId(["x", "1);drop"])).toEqual([]);
    expect(llamadas).toHaveLength(0);
    await cliente.porId(["7", "7", "abc"]);
    expect(llamadas.at(-1)?.url).toContain("filter[id]=in.(7)");
  });
  it("traduce 429 y otros errores a mensajes seguros", async () => {
    await expect(falso({ estados: [429] }).cliente.buscar("")).rejects.toThrow(/7 segundos/);
    await expect(falso({ estados: [500] }).cliente.buscar("")).rejects.toThrow(/error 500/);
  });
});
