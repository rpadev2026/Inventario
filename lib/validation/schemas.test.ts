import { describe, it, expect } from "vitest";
import { facturaSchema, productoSchema, proveedorSchema, rolSchema, sucursalSchema } from "./schemas";
import { catalogoSchema } from "./catalogo";

const base = { idProveedor: 1, folio: 10, fechaFactura: "2026-10-01", fechaRecepcion: "2026-10-02", formaPago: "Contado",
  neto: 1000, iva: 190, total: 1190, detalle: [{ producto: 1, precio: 500, cantidad: 2 }] };

describe("factura", () => {
  it("acepta factura consistente", () => expect(facturaSchema.safeParse(base).success).toBe(true));
  it("rechaza total inconsistente", () => expect(facturaSchema.safeParse({ ...base, total: 5000 }).success).toBe(false));
  it("rechaza sin detalle", () => expect(facturaSchema.safeParse({ ...base, detalle: [] }).success).toBe(false));
  it("rechaza cantidad 0", () => expect(facturaSchema.safeParse({ ...base, detalle: [{ producto: 1, precio: 1, cantidad: 0 }] }).success).toBe(false));
  it("rechaza recepción anterior a la factura con el mensaje exacto", () => {
    const r = facturaSchema.safeParse({ ...base, fechaFactura: "2026-10-02", fechaRecepcion: "2026-10-01" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const i = r.error.issues.find((x) => x.path[0] === "fechaRecepcion");
      expect(i?.message).toBe("La fecha de recepción no puede ser anterior a la fecha de factura");
    }
  });
  it("acepta recepción el mismo día", () =>
    expect(facturaSchema.safeParse({ ...base, fechaFactura: "2026-10-02", fechaRecepcion: "2026-10-02" }).success).toBe(true));
  it("folio en texto numérico se convierte a número", () => {
    const r = facturaSchema.safeParse({ ...base, folio: "123" });
    expect(r.success && r.data.folio).toBe(123);
  });
  it.each(["12a", "0", "007", "1234567890123456", "-5", "1.5"])("rechaza folio %s", (folio) =>
    expect(facturaSchema.safeParse({ ...base, folio }).success).toBe(false));
  it.each([0, -3, 1.5])("rechaza folio numérico %s", (folio) =>
    expect(facturaSchema.safeParse({ ...base, folio }).success).toBe(false));
  it("precio '10,50' pasa y se convierte", () => {
    const r = facturaSchema.safeParse({ ...base, detalle: [{ producto: 1, precio: "10,50", cantidad: 1 }] });
    expect(r.success && r.data.detalle[0].precio).toBe(10.5);
  });
  it("precio '10,555' falla con mensaje", () => {
    const r = facturaSchema.safeParse({ ...base, detalle: [{ producto: 1, precio: "10,555", cantidad: 1 }] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Precio: máximo 2 decimales");
  });
  it("rechaza precio numérico con más de 2 decimales y negativo", () => {
    expect(facturaSchema.safeParse({ ...base, detalle: [{ producto: 1, precio: 1.234, cantidad: 1 }] }).success).toBe(false);
    expect(facturaSchema.safeParse({ ...base, detalle: [{ producto: 1, precio: -1, cantidad: 1 }] }).success).toBe(false);
  });
  it("formaPago 'contado' se normaliza a CONTADO", () => {
    const r = facturaSchema.safeParse({ ...base, formaPago: "contado" });
    expect(r.success && r.data.formaPago).toBe("CONTADO");
  });
});
describe("producto", () => {
  const p = { codigo: "HAR-01", nombre: "Harina", unidad: "KG", formato: "BOLSA", precioCompra: "1500", stockMinimo: 10, stockCritico: 5 };
  it("acepta", () => expect(productoSchema.safeParse(p).success).toBe(true));
  it("rechaza crítico > mínimo", () => expect(productoSchema.safeParse({ ...p, stockCritico: 20 }).success).toBe(false));
  it("normaliza unidad a mayúsculas", () => {
    const r = productoSchema.safeParse({ ...p, unidad: "kg" });
    expect(r.success && r.data.unidad).toBe("KG");
  });
  it("rechaza unidad inválida", () => expect(productoSchema.safeParse({ ...p, unidad: "Tonelada x" }).success).toBe(false));
  it("código vacío o con espacios queda como no informado", () => {
    for (const codigo of ["", "   "]) {
      const r = productoSchema.safeParse({ ...p, codigo });
      expect(r.success && r.data.codigo).toBeUndefined();
    }
  });
  it("sin código también se acepta", () => {
    const { codigo: _c, ...sin } = p;
    expect(productoSchema.safeParse(sin).success).toBe(true);
  });
  it("rechaza código con caracteres no permitidos", () => expect(productoSchema.safeParse({ ...p, codigo: "a b" }).success).toBe(false));
  it("precio de compra: '1500' y '10,50' pasan; '10,555', negativo y vacío fallan con mensaje", () => {
    const r = productoSchema.safeParse({ ...p, precioCompra: "10,50" });
    expect(r.success && r.data.precioCompra).toBe(10.5);
    for (const precioCompra of ["10,555", "-1", ""]) {
      const x = productoSchema.safeParse({ ...p, precioCompra });
      expect(x.success).toBe(false);
      if (!x.success) expect(x.error.issues[0].message).toBe("Precio: máximo 2 decimales");
    }
  });
  it("rechaza un precio de compra que no cabe en numeric(12,2)", () =>
    expect(productoSchema.safeParse({ ...p, precioCompra: "10000000000" }).success).toBe(false));
});
describe("factura: producto por id", () => {
  it.each([0, -1, "abc", 1.5])("rechaza producto %s", (producto) =>
    expect(facturaSchema.safeParse({ ...base, detalle: [{ producto, precio: 1, cantidad: 1 }] }).success).toBe(false));
  it("acepta producto en texto numérico y lo convierte", () => {
    const r = facturaSchema.safeParse({ ...base, detalle: [{ producto: "3", precio: 1, cantidad: 1 }] });
    expect(r.success && r.data.detalle[0].producto).toBe(3);
  });
});
describe("proveedor", () => {
  it("rechaza RUT inválido", () => expect(proveedorSchema.safeParse({ rut: "1-1", razonSocial: "X" }).success).toBe(false));
  it("acepta mínimo válido", () => expect(proveedorSchema.safeParse({ rut: "76.086.428-5", razonSocial: "X" }).success).toBe(true));
});
describe("territorio en proveedor y sucursal", () => {
  const prov = { rut: "76.086.428-5", razonSocial: "X" };
  const suc = { direccion: "Calle 1" };
  const casos: [string, (t: object) => { success: boolean; data?: { region: string | null; ciudad: string | null; comuna: string | null }; error?: { issues: unknown[] } }][] = [
    ["proveedor", (t) => proveedorSchema.safeParse({ ...prov, ...t })],
    ["sucursal", (t) => sucursalSchema.safeParse({ ...suc, ...t })],
  ];
  for (const [nombre, parse] of casos) {
    it(`${nombre}: acepta vacío, región sola y trío`, () => {
      expect(parse({}).success).toBe(true);
      expect(parse({ region: "13" }).success).toBe(true);
      const r = parse({ region: "13", ciudad: "131", comuna: "13101" });
      expect([r.data?.region, r.data?.ciudad, r.data?.comuna]).toEqual(["13", "131", "13101"]);
    });
    it(`${nombre}: rechaza comuna sin ciudad`, () => {
      const r = parse({ region: "13", comuna: "13101" });
      expect(r.error?.issues[0]).toMatchObject({ message: "La comuna requiere ciudad", path: ["comuna"] });
    });
    it(`${nombre}: rechaza ciudad sin región`, () => {
      const r = parse({ ciudad: "131" });
      expect(r.error?.issues[0]).toMatchObject({ message: "La ciudad requiere región", path: ["ciudad"] });
    });
  }
});
describe("catalogo", () => {
  it("normaliza código y acepta", () => {
    const r = catalogoSchema.safeParse({ codigo: " contado ", nombre: "Contado" });
    expect(r.success && r.data.codigo).toBe("CONTADO");
  });
  it("rechaza código con espacios", () => expect(catalogoSchema.safeParse({ codigo: "A B", nombre: "X" }).success).toBe(false));
  it("rechaza código de más de 30", () => expect(catalogoSchema.safeParse({ codigo: "A".repeat(31), nombre: "X" }).success).toBe(false));
  it("rechaza nombre vacío", () => expect(catalogoSchema.safeParse({ codigo: "A", nombre: " " }).success).toBe(false));
});
describe("rol", () => {
  it("acepta permisos vac�os y detalle vac�o -> null", () => {
    const r = rolSchema.safeParse({ nombre: " Consulta ", detalle: "" });
    expect(r.success && r.data.permisos).toEqual([]);
    expect(r.success && r.data.detalle).toBeNull();
    expect(r.success && r.data.nombre).toBe("Consulta");
  });
  it("rechaza permiso fuera del catalogo", () => expect(rolSchema.safeParse({ nombre: "X", permisos: ["compras.borrar"] }).success).toBe(false));
  it("acepta permiso del catalogo", () => expect(rolSchema.safeParse({ nombre: "X", permisos: ["compras.ver"] }).success).toBe(true));
  it("rechaza nombre vacio", () => expect(rolSchema.safeParse({ nombre: "  " }).success).toBe(false));
  it("rechaza detalle de mas de 200", () => expect(rolSchema.safeParse({ nombre: "X", detalle: "a".repeat(201) }).success).toBe(false));
});
