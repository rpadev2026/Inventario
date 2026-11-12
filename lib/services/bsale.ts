/**
 * Cliente de la API de Bsale (Chile) para leer las facturas de proveedores recibidas ("documentos de terceros").
 * Solo trae la cabecera del documento (la API no entrega las líneas). Sin saber de Next ni del entorno: recibe el token y
 * `fetch` como dependencias para probarlo con respuestas falsas (`bsale.test.ts`); `bsale()` arma el cliente real.
 */
import { conTimeout } from "@/lib/http-timeout";

export type FacturaRecibida = {
  id: number;
  /** Código tributario del SII: 33 factura electrónica, 34 factura exenta. */
  codigoSii: string;
  folio: number;
  /** Fecha de emisión, AAAA-MM-DD. */
  fecha: string;
  rutProveedor: string;
  razonSocial: string;
  neto: number;
  exento: number;
  iva: number;
  total: number;
  urlPdf: string | null;
  /** Códigos SII de la respuesta del receptor (ACD, RCD, ERM...); vacío si aún no hay ninguno. */
  estadoSii: string[];
};
/** Una línea del detalle del DTE (XML del SII). `exento`: la línea no lleva IVA. */
export type LineaDte = { codigo: string; nombre: string; unidad: string; cantidad: number; precioNeto: number; montoNeto: number; exento: boolean };
export type PaginaFacturas = { facturas: FacturaRecibida[]; hayMas: boolean };
export type ClienteBsale = {
  /** Una página de facturas recibidas, las más recientes primero. `pagina` empieza en 1. */
  facturasRecibidas(pagina: number, filtro?: FiltroFacturas): Promise<PaginaFacturas>;
  /** Líneas de una factura recibida, leídas del XML del DTE; vacío si Bsale no entrega el XML. */
  lineasFactura(id: number): Promise<LineaDte[]>;
};
/** `folio` y `rut` (formato de Bsale: sin puntos, con guion) se combinan con «y». */
export type FiltroFacturas = { folio?: number; rut?: string };
type Deps = { token: string; fetch?: typeof fetch; base?: string; timeoutMs?: number };
type Documento = {
  id: number; codeSii: string; emissionDate: number; number: number; clientCode: string; clientActivity: string;
  netAmount: number; exemptAmount: number; ivaAmount: number; totalAmount: number; bookType: string; canceled: number; urlPdf: string | null; urlXml?: string | null; siiStatus?: unknown;
};

export const POR_PAGINA = 50; // máximo que permite la API
const CODIGOS_FACTURA = new Set(["33", "34"]);

const aFactura = (d: Documento): FacturaRecibida => ({
  id: d.id, codigoSii: String(d.codeSii), folio: Number(d.number),
  fecha: new Date(d.emissionDate * 1000).toISOString().slice(0, 10), // la API entrega solo la fecha (sin zona horaria): se lee en UTC
  rutProveedor: d.clientCode, razonSocial: d.clientActivity,
  neto: Number(d.netAmount), exento: Number(d.exemptAmount), iva: Number(d.ivaAmount), total: Number(d.totalAmount), urlPdf: d.urlPdf ?? null,
  estadoSii: Array.isArray(d.siiStatus) ? d.siiStatus.map(String) : [],
});

const entidades: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const texto = (x: string) => x.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => entidades[e]).trim();
const campo = (bloque: string, tag: string) => bloque.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? "";

/** Líneas `<Detalle>` de un DTE del SII. Sin librería de XML: el formato es fijo y plano (shortcut: no valida el esquema, ni lee descuentos globales). */
export function parsearLineasDte(xml: string): LineaDte[] {
  return [...xml.matchAll(/<Detalle>([\s\S]*?)<\/Detalle>/g)].map(([, d]) => {
    const cantidad = Number(campo(d, "QtyItem") || 1);
    const precioNeto = Number(campo(d, "PrcItem"));
    const monto = Number(campo(d, "MontoItem"));
    return {
      codigo: texto(campo(campo(d, "CdgItem"), "VlrCodigo")), nombre: texto(campo(d, "NmbItem")), unidad: texto(campo(d, "UnmdItem")),
      cantidad, precioNeto, montoNeto: Number.isFinite(monto) && monto > 0 ? monto : Math.round(precioNeto * cantidad),
      exento: campo(d, "IndExe") !== "",
    };
  }).filter((l) => l.nombre && Number.isFinite(l.cantidad) && l.cantidad > 0);
}

export function crearClienteBsale(d: Deps): ClienteBsale {
  const f = conTimeout(d.fetch ?? fetch, d.timeoutMs ?? 20_000, "Bsale");
  const base = d.base ?? "https://api.bsale.io/v1";

  async function pedir<T>(ruta: string): Promise<T> {
    const r = await f(`${base}${ruta}`, { headers: { access_token: d.token, Accept: "application/json" } });
    if (r.status === 401 || r.status === 403) throw new Error("Bsale rechazó el token de acceso");
    if (!r.ok) throw new Error(`Bsale respondió con error ${r.status}`);
    return (await r.json()) as T;
  }

  return {
    async facturasRecibidas(pagina, filtro = {}) {
      const p = Math.max(1, Math.floor(pagina));
      const esFactura = (x: Documento) => CODIGOS_FACTURA.has(String(x.codeSii)) && x.bookType === "compra" && !x.canceled;
      const filtros = [filtro.folio ? `number=${Math.floor(filtro.folio)}` : "", filtro.rut ? `clientcode=${encodeURIComponent(filtro.rut)}` : ""].filter(Boolean);
      if (filtros.length) {
        // Con filtro no hay conteo: se pagina desde el principio de lo filtrado (el resultado suele ser corto), más nuevas primero dentro de la página.
        const offset = (p - 1) * POR_PAGINA;
        const { items } = await pedir<{ items: Documento[] }>(`/third_party_documents.json?limit=${POR_PAGINA}&offset=${offset}&${filtros.join("&")}`);
        return { facturas: items.filter(esFactura).map(aFactura).sort((a, b) => b.id - a.id), hayMas: items.length === POR_PAGINA };
      }
      // shortcut: se asume que la API ordena por id ascendente (como en su documentación): se lee desde el final para mostrar lo más nuevo
      // primero, y como el filtro por tipo se aplica aquí, una página puede traer menos de 50 facturas. Confirmar con una cuenta real.
      const { count } = await pedir<{ count: number }>("/third_party_documents/count.json");
      const hasta = count - (p - 1) * POR_PAGINA;
      if (hasta <= 0) return { facturas: [], hayMas: false };
      const offset = Math.max(0, hasta - POR_PAGINA);
      const { items } = await pedir<{ items: Documento[] }>(`/third_party_documents.json?limit=${hasta - offset}&offset=${offset}`);
      return { facturas: items.filter(esFactura).map(aFactura).sort((a, b) => b.id - a.id), hayMas: offset > 0 };
    },
    async lineasFactura(id) {
      const doc = await pedir<Documento>(`/third_party_documents/${Math.floor(id)}.json`);
      // La dirección del XML la entrega Bsale: se exige https y no se le manda el token (shortcut: no se restringe el dominio; confirmar cuál usa Bsale).
      if (!doc.urlXml || !doc.urlXml.startsWith("https://")) return [];
      const r = await f(doc.urlXml);
      if (!r.ok) throw new Error(`El XML de Bsale respondió con error ${r.status}`);
      const buf = await r.arrayBuffer();
      if (buf.byteLength > 2_000_000) throw new Error("El XML de Bsale es demasiado grande");
      const cabecera = new TextDecoder("latin1").decode(buf.slice(0, 100)); // el DTE del SII suele venir en ISO-8859-1
      return parsearLineasDte(new TextDecoder(/ISO-8859-1/i.test(cabecera) ? "latin1" : "utf-8").decode(buf));
    },
  };
}

let real: ClienteBsale | null | undefined;
/** Cliente con el token del entorno (`BSALE_ACCESS_TOKEN`); null si no está definido. */
export function bsale(): ClienteBsale | null {
  if (real === undefined) real = process.env.BSALE_ACCESS_TOKEN ? crearClienteBsale({ token: process.env.BSALE_ACCESS_TOKEN }) : null;
  return real;
}
