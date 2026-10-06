export type Borrador = {
  idProv: string;
  folio: string;
  fechaFactura: string;
  fechaRecepcion: string;
  formaPago: string;
  lineas: { producto: string; precio: string; cantidad: string }[];
};

const CLAVE = "borrador-factura";

function esTexto(x: unknown): x is string {
  return typeof x === "string";
}

function esBorrador(x: unknown): x is Borrador {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  if (![o.idProv, o.folio, o.fechaFactura, o.fechaRecepcion, o.formaPago].every(esTexto)) return false;
  if (!Array.isArray(o.lineas)) return false;
  return o.lineas.every((l) => {
    if (typeof l !== "object" || l === null || Array.isArray(l)) return false;
    const r = l as Record<string, unknown>;
    return esTexto(r.producto) && esTexto(r.precio) && esTexto(r.cantidad);
  });
}

export function guardarBorrador(b: Borrador): void {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(b));
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
}

export function leerBorrador(): Borrador | null {
  try {
    const txt = sessionStorage.getItem(CLAVE);
    if (!txt) return null;
    const dato: unknown = JSON.parse(txt);
    if (!esBorrador(dato)) return null;
    return {
      idProv: dato.idProv,
      folio: dato.folio,
      fechaFactura: dato.fechaFactura,
      fechaRecepcion: dato.fechaRecepcion,
      formaPago: dato.formaPago,
      lineas: dato.lineas.map((l) => ({ producto: l.producto, precio: l.precio, cantidad: l.cantidad })),
    };
  } catch {
    return null;
  }
}

export function limpiarBorrador(): void {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    /* se ignora */
  }
}

type LineaBorrador = Borrador["lineas"][number];

/** Pone `producto` (IdProducto) en la primera línea sin producto; si todas tienen, agrega una línea nueva. No muta la entrada. */
export function aplicarPreProducto(lineas: LineaBorrador[], producto: string): LineaBorrador[] {
  const i = lineas.findIndex((l) => l.producto === "");
  if (i === -1) return [...lineas, { producto, precio: "", cantidad: "" }];
  return lineas.map((l, j) => (j === i ? { ...l, producto } : l));
}
