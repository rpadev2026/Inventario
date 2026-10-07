import { describe, it, expect } from "vitest";
import { calcularTotales } from "./factura-calculo";

describe("calcularTotales (el precio de cada línea ya incluye IVA)", () => {
  it("el total es la suma de las líneas; neto = total / 1,19 e IVA = total - neto", () => {
    expect(calcularTotales([{ precio: 1000, cantidad: 50 }])).toEqual({ total: 50000, neto: 42017, iva: 7983 });
  });
  it("119 con IVA = 100 neto + 19 de IVA", () => {
    expect(calcularTotales([{ precio: 119, cantidad: 1 }])).toEqual({ total: 119, neto: 100, iva: 19 });
  });
  it("suma varias líneas con decimales y redondea el total a pesos", () => {
    const r = calcularTotales([{ precio: 10.5, cantidad: 3 }, { precio: 1300, cantidad: 50.5 }]);
    expect(r.total).toBe(Math.round(31.5 + 65650));
  });
  it("neto + IVA siempre igualan al total", () => {
    for (const precio of [1, 7, 99, 1234.56, 59999.99]) {
      const r = calcularTotales([{ precio, cantidad: 3 }]);
      expect(r.neto + r.iva).toBe(r.total);
    }
  });
  it("sin líneas o con datos inválidos todo es 0", () => {
    expect(calcularTotales([])).toEqual({ total: 0, neto: 0, iva: 0 });
    expect(calcularTotales([{ precio: NaN, cantidad: 2 }])).toEqual({ total: 0, neto: 0, iva: 0 });
  });
});
