import { describe, it, expect } from "vitest";
import { crearClienteBsale, parsearLineasDte } from "./bsale";

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
      neto: 1000, exento: 0, iva: 190, total: 1190, urlPdf: null, estadoSii: [],
    });
  });
  it("traduce un token inválido y otros errores a mensajes seguros", async () => {
    await expect(falso(1, 401).cliente.facturasRecibidas(1)).rejects.toThrow(/token de acceso/);
    await expect(falso(1, 500).cliente.facturasRecibidas(1)).rejects.toThrow(/error 500/);
  });
});

describe("filtros, estado SII y líneas del DTE", () => {
  const dte = `<?xml version="1.0" encoding="ISO-8859-1"?><DTE><Documento>
    <Detalle><NroLinDet>1</NroLinDet><CdgItem><TpoCodigo>INT1</TpoCodigo><VlrCodigo>ab-1</VlrCodigo></CdgItem><NmbItem>Aceite &amp; Ají</NmbItem><QtyItem>2</QtyItem><UnmdItem>UN</UnmdItem><PrcItem>1000</PrcItem><MontoItem>2000</MontoItem></Detalle>
    <Detalle><NmbItem>Sal</NmbItem><IndExe>1</IndExe><QtyItem>1</QtyItem><PrcItem>10</PrcItem></Detalle>
    <Detalle><NmbItem>Sin cantidad válida</NmbItem><QtyItem>0</QtyItem></Detalle>
  </Documento></DTE>`;

  it("parsea el detalle: entidades, exentos y monto neto", () => {
    const l = parsearLineasDte(dte);
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ codigo: "ab-1", nombre: "Aceite & Ají", unidad: "UN", cantidad: 2, precioNeto: 1000, montoNeto: 2000, exento: false });
    expect(l[1]).toMatchObject({ nombre: "Sal", cantidad: 1, exento: true, montoNeto: 10 });
  });
  it("con folio o RUT pagina desde el principio y manda los filtros", async () => {
    const urls: string[] = [];
    const cliente = crearClienteBsale({ token: "t", fetch: (async (url: string) => { urls.push(url); return new Response(JSON.stringify({ items: [doc(7)] }), { status: 200 }); }) as unknown as typeof fetch });
    const p = await cliente.facturasRecibidas(1, { folio: 1007, rut: "76086428-5" });
    expect(p.facturas.map((f) => f.id)).toEqual([7]);
    expect(p.hayMas).toBe(false);
    expect(urls[0]).toContain("limit=50&offset=0&number=1007&clientcode=76086428-5");
  });
  it("mapea siiStatus y lee el XML sin mandar el token; ignora URL que no son https", async () => {
    const llamadas: { url: string; headers?: unknown }[] = [];
    const bytes = new TextEncoder().encode(dte.replace("Ají", "Aji"));
    const respuesta = (urlXml: string | null) => (async (url: string, init?: RequestInit) => {
      llamadas.push({ url, headers: init?.headers });
      if (url.includes("/third_party_documents/")) return new Response(JSON.stringify(doc(5, { urlXml, siiStatus: ["ERM"] })), { status: 200 });
      return new Response(bytes, { status: 200 });
    }) as unknown as typeof fetch;
    const cliente = crearClienteBsale({ token: "tok", fetch: respuesta("https://x.test/a.xml") });
    expect((await cliente.lineasFactura(5)).map((l) => l.nombre)).toEqual(["Aceite & Aji", "Sal"]);
    expect(llamadas[1].headers).toBeUndefined();
    expect(await crearClienteBsale({ token: "t", fetch: respuesta("http://x.test/a.xml") }).lineasFactura(5)).toEqual([]);
    expect(await crearClienteBsale({ token: "t", fetch: respuesta(null) }).lineasFactura(5)).toEqual([]);
  });
  it("estadoSii sale de siiStatus", async () => {
    const cliente = crearClienteBsale({ token: "t", fetch: (async () => new Response(JSON.stringify({ items: [doc(1, { siiStatus: ["ACD", "ERM"] })] }), { status: 200 })) as unknown as typeof fetch });
    expect((await cliente.facturasRecibidas(1, { folio: 1001 })).facturas[0].estadoSii).toEqual(["ACD", "ERM"]);
  });
});
