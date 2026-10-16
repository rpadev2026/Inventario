/**
 * Cliente de la API de Bsale (Chile) para leer las facturas de proveedores recibidas ("documentos de terceros").
 * Solo trae la cabecera del documento (la API no entrega las líneas). Sin saber de Next ni del entorno: recibe el token y
 * `fetch` como dependencias para probarlo con respuestas falsas (`bsale.test.ts`); `bsale()` arma el cliente real.
 */
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
};
export type PaginaFacturas = { facturas: FacturaRecibida[]; hayMas: boolean };
export type ClienteBsale = {
  /** Una página de facturas recibidas, las más recientes primero. `pagina` empieza en 1. */
  facturasRecibidas(pagina: number): Promise<PaginaFacturas>;
};
type Deps = { token: string; fetch?: typeof fetch; base?: string };
type Documento = {
  id: number; codeSii: string; emissionDate: number; number: number; clientCode: string; clientActivity: string;
  netAmount: number; exemptAmount: number; ivaAmount: number; totalAmount: number; bookType: string; canceled: number; urlPdf: string | null;
};

export const POR_PAGINA = 50; // máximo que permite la API
const CODIGOS_FACTURA = new Set(["33", "34"]);

const aFactura = (d: Documento): FacturaRecibida => ({
  id: d.id, codigoSii: String(d.codeSii), folio: Number(d.number),
  fecha: new Date(d.emissionDate * 1000).toISOString().slice(0, 10), // la API entrega solo la fecha (sin zona horaria): se lee en UTC
  rutProveedor: d.clientCode, razonSocial: d.clientActivity,
  neto: Number(d.netAmount), exento: Number(d.exemptAmount), iva: Number(d.ivaAmount), total: Number(d.totalAmount), urlPdf: d.urlPdf ?? null,
});

export function crearClienteBsale(d: Deps): ClienteBsale {
  const f = d.fetch ?? fetch;
  const base = d.base ?? "https://api.bsale.io/v1";

  async function pedir<T>(ruta: string): Promise<T> {
    const r = await f(`${base}${ruta}`, { headers: { access_token: d.token, Accept: "application/json" } });
    if (r.status === 401 || r.status === 403) throw new Error("Bsale rechazó el token de acceso");
    if (!r.ok) throw new Error(`Bsale respondió con error ${r.status}`);
    return (await r.json()) as T;
  }

  return {
    async facturasRecibidas(pagina) {
      const p = Math.max(1, Math.floor(pagina));
      // shortcut: se asume que la API ordena por id ascendente (como en su documentación): se lee desde el final para mostrar lo más nuevo
      // primero, y como el filtro por tipo se aplica aquí, una página puede traer menos de 50 facturas. Confirmar con una cuenta real.
      const { count } = await pedir<{ count: number }>("/third_party_documents/count.json");
      const hasta = count - (p - 1) * POR_PAGINA;
      if (hasta <= 0) return { facturas: [], hayMas: false };
      const offset = Math.max(0, hasta - POR_PAGINA);
      const { items } = await pedir<{ items: Documento[] }>(`/third_party_documents.json?limit=${hasta - offset}&offset=${offset}`);
      const facturas = items
        .filter((x) => CODIGOS_FACTURA.has(String(x.codeSii)) && x.bookType === "compra" && !x.canceled)
        .map(aFactura)
        .sort((a, b) => b.id - a.id);
      return { facturas, hayMas: offset > 0 };
    },
  };
}

let real: ClienteBsale | null | undefined;
/** Cliente con el token del entorno (`BSALE_ACCESS_TOKEN`); null si no está definido. */
export function bsale(): ClienteBsale | null {
  if (real === undefined) real = process.env.BSALE_ACCESS_TOKEN ? crearClienteBsale({ token: process.env.BSALE_ACCESS_TOKEN }) : null;
  return real;
}
