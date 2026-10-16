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
