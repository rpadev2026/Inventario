import { describe, it, expect } from "vitest";
import { crearClienteBsale } from "./bsale";

const doc = (id: number, extra: object = {}) => ({
  id, codeSii: "33", emissionDate: 1330657200, number: 1000 + id, clientCode: "76086428-5", clientActivity: "PROV SA",
  netAmount: 1000, exemptAmount: 0, ivaAmount: 190, totalAmount: 1190, bookType: "compra", canceled: 0, urlPdf: null, ...extra,
});

/** Servidor falso: `total` documentos con id 1..total; registra las URL y la cabecera de acceso. */
function falso(total: number, estado = 200) {
  const llamadas: { url: string; token?: string }[] = [];
  const fetchFalso = (async (url: string, init?: RequestInit) => {
    llamadas.push({ url, token: (init?.headers as Record<string, string>).access_token });
    if (estado !== 200) return new Response("", { status: estado });
    if (url.includes("count.json")) return new Response(JSON.stringify({ count: total }), { status: 200 });
    const q = new URL(url).searchParams;
    const off = Number(q.get("offset")), lim = Number(q.get("limit"));
    const items = Array.from({ length: Math.max(0, Math.min(lim, total - off)) }, (_, i) => doc(off + i + 1));
    return new Response(JSON.stringify({ items }), { status: 200 });
  }) as unknown as typeof fetch;
  return { cliente: crearClienteBsale({ token: "tok", fetch: fetchFalso }), llamadas };
}

describe("cliente de Bsale", () => {
  it("lee desde el final (lo más nuevo primero) y manda el token en la cabecera", async () => {
    const { cliente, llamadas } = falso(120);
    const p = await cliente.facturasRecibidas(1);
    expect(p.facturas.map((f) => f.id)).toEqual(Array.from({ length: 50 }, (_, i) => 120 - i));
    expect(p.hayMas).toBe(true);
    expect(llamadas.every((l) => l.token === "tok")).toBe(true);
    expect(llamadas.at(-1)?.url).toContain("limit=50&offset=70");
  });
  it("la última página trae el resto y avisa que no hay más", async () => {
    const { cliente } = falso(120);
    const p = await cliente.facturasRecibidas(3);
    expect(p.facturas.map((f) => f.id)).toEqual(Array.from({ length: 20 }, (_, i) => 20 - i));
    expect(p.hayMas).toBe(false);
    expect((await cliente.facturasRecibidas(4)).facturas).toEqual([]);
  });
  it("mapea el documento y toma la fecha en UTC", async () => {
    const { facturas } = await falso(1).cliente.facturasRecibidas(1);
    expect(facturas[0]).toEqual({
      id: 1, codigoSii: "33", folio: 1001, fecha: "2012-03-02", rutProveedor: "76086428-5", razonSocial: "PROV SA",
      neto: 1000, exento: 0, iva: 190, total: 1190, urlPdf: null,
    });
  });
  it("traduce un token inválido y otros errores a mensajes seguros", async () => {
    await expect(falso(1, 401).cliente.facturasRecibidas(1)).rejects.toThrow(/token de acceso/);
    await expect(falso(1, 500).cliente.facturasRecibidas(1)).rejects.toThrow(/error 500/);
  });
});
