import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aplicarPreProducto, guardarBorrador, leerBorrador, limpiarBorrador, type Borrador } from "./borrador-factura";

const CLAVE = "borrador-factura";
let almacen: Map<string, string>;

const valido: Borrador = {
  idProv: "3", folio: "123", fechaFactura: "2026-10-01", fechaRecepcion: "2026-10-02", formaPago: "CONTADO",
  lineas: [{ producto: "7", precio: "1,5", cantidad: "10" }],
};

beforeEach(() => {
  almacen = new Map();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: (k: string) => (almacen.has(k) ? almacen.get(k)! : null),
    setItem: (k: string, v: string) => void almacen.set(k, v),
    removeItem: (k: string) => void almacen.delete(k),
  };
});
afterEach(() => {
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
});

describe("borrador de factura", () => {
  it("ida y vuelta de un borrador válido", () => {
    guardarBorrador(valido);
    expect(leerBorrador()).toEqual(valido);
  });
  it.each(["{", "[]", '{"idProv":5}', "null", '"x"', JSON.stringify({ ...valido, lineas: [{ producto: 1 }] }), JSON.stringify({ ...valido, lineas: "x" })])(
    "forma inválida %s → null",
    (txt) => {
      almacen.set(CLAVE, txt);
      expect(leerBorrador()).toBeNull();
    },
  );
  it("sin nada guardado → null", () => {
    expect(leerBorrador()).toBeNull();
  });
  it("limpiarBorrador borra", () => {
    guardarBorrador(valido);
    limpiarBorrador();
    expect(leerBorrador()).toBeNull();
  });
  it("sin sessionStorage no lanza", () => {
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    expect(() => guardarBorrador(valido)).not.toThrow();
    expect(leerBorrador()).toBeNull();
    expect(() => limpiarBorrador()).not.toThrow();
  });
});

describe("aplicarPreProducto", () => {
  it("usa la primera línea sin producto", () => {
    const ls = [{ producto: "A", precio: "1", cantidad: "2" }, { producto: "", precio: "5", cantidad: "" }];
    expect(aplicarPreProducto(ls, "E2E-1")).toEqual([
      { producto: "A", precio: "1", cantidad: "2" },
      { producto: "E2E-1", precio: "5", cantidad: "" },
    ]);
    expect(ls[1].producto).toBe("");
  });
  it("agrega una línea nueva si todas tienen producto", () => {
    expect(aplicarPreProducto([{ producto: "A", precio: "1", cantidad: "2" }], "B")).toEqual([
      { producto: "A", precio: "1", cantidad: "2" },
      { producto: "B", precio: "", cantidad: "" },
    ]);
  });
});

describe("borrador con el formato viejo (codigo)", () => {
  it("se ignora sin romper", () => {
    almacen.set(CLAVE, JSON.stringify({ ...valido, lineas: [{ codigo: "HAR-001", precio: "1", cantidad: "2" }] }));
    expect(leerBorrador()).toBeNull();
  });
});
