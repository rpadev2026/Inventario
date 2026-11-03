import { describe, it, expect } from "vitest";
import { lineasDesdeDte } from "./bsale-lineas";

const u = (Codigo: string, Nombre: string, UnidadBase: string, Factor = 1) => ({ Codigo, Nombre, IdEstado: 1, UnidadBase, Factor });
const unidades = [u("G", "Gramo", "G"), u("KG", "Kilogramo", "G", 1000), u("UN", "Unidad", "UN")];
const prods = [{ id: 1, codigo: "AB-1", nombre: "HARINA", unidadBase: "G" }, { id: 2, codigo: null, nombre: "HUEVO", unidadBase: "UN" }];
const dte = (extra: object) => ({ codigo: "", nombre: "x", unidad: "KG", cantidad: 2, precioNeto: 1000, montoNeto: 2000, exento: false, ...extra });

describe("líneas del DTE → líneas de factura", () => {
  it("cruza por código y convierte a precio con IVA", () => {
    const r = lineasDesdeDte([dte({ codigo: "ab-1" })], prods, unidades);
    expect(r.lineas).toEqual([{ producto: "1", unidad: "KG", precio: "1190", cantidad: "2" }]);
  });
  it("cruza por nombre y respeta lo exento y el descuento (monto neto)", () => {
    const r = lineasDesdeDte([dte({ nombre: "huevo", unidad: "unidad", exento: true, cantidad: 3, montoNeto: 900 })], prods, unidades);
    expect(r.lineas).toEqual([{ producto: "2", unidad: "UN", precio: "300", cantidad: "3" }]);
  });
  it("sin producto, sin unidad o con unidad de otra familia: queda sin cruzar", () => {
    const l = [dte({ nombre: "OTRO" }), dte({ codigo: "AB-1", unidad: "" }), dte({ codigo: "AB-1", unidad: "UN" })];
    const r = lineasDesdeDte(l, prods, unidades);
    expect(r.lineas).toEqual([]);
    expect(r.sinCruzar).toHaveLength(3);
  });
});
