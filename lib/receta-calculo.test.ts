import { describe, it, expect } from "vitest";
import { calcularLinea, calcularReceta, type LineaCalculo } from "./receta-calculo";

const L = (extra: Partial<LineaCalculo> = {}): LineaCalculo => ({ cantidad: 1, porcion: 500, merma: 0.3, factorUnidad: 1, costoPorBase: 0.001, ...extra });

describe("calcularLinea", () => {
  it("bruto = cantidad × porción × (1 + merma) y costo = bruto × factor × costo base", () => {
    const r = calcularLinea(L());
    expect(r.bruto).toBeCloseTo(650);
    expect(r.costo).toBeCloseTo(0.65);
  });
  it("la unidad de la línea se convierte a base con su factor (0,5 KG = 500 G)", () => {
    const r = calcularLinea(L({ porcion: 0.5, factorUnidad: 1000 }));
    expect(r.bruto).toBeCloseTo(0.65);
    expect(r.costo).toBeCloseTo(0.65);
  });
  it("Cantidad multiplica", () => { expect(calcularLinea(L({ cantidad: 2 })).costo).toBeCloseTo(1.3); });
  it("sin costo base: costo null", () => { expect(calcularLinea(L({ costoPorBase: null })).costo).toBeNull(); });
  it("el costo se redondea a 2 decimales", () => { expect(calcularLinea(L({ porcion: 100, merma: 0, costoPorBase: 0.3333 })).costo).toBe(33.33); });
});

describe("calcularReceta", () => {
  it("suma las líneas con costo, marca incompleta y divide por las porciones", () => {
    const r = calcularReceta([L({ porcion: 100, merma: 0, costoPorBase: 1 }), L({ costoPorBase: null })], 3);
    expect(r.total).toBe(100);
    expect(r.porcion).toBe(33.33);
    expect(r.incompleto).toBe(true);
  });
  it("completa si todas las líneas tienen costo", () => {
    expect(calcularReceta([L()], 1).incompleto).toBe(false);
  });
});

describe("redondeo a 2 decimales como numeric: mitades hacia arriba sin error de coma flotante", () => {
  const costo = (porcion: number) => calcularLinea({ cantidad: 1, porcion, merma: 0, factorUnidad: 1, costoPorBase: 1 }).costo;
  it("1,005 → 1,01 (con coma flotante ingenua daría 1,00)", () => { expect(costo(1.005)).toBe(1.01); });
  it("2,135 → 2,14 y 4,015 → 4,02 (con EPSILON daba 2,13 y 4,01)", () => { expect(costo(2.135)).toBe(2.14); expect(costo(4.015)).toBe(4.02); });
  it("2,675 → 2,68 y 0,285 → 0,29", () => { expect(costo(2.675)).toBe(2.68); expect(costo(0.285)).toBe(0.29); });
  it("valores muy pequeños dan 0", () => { expect(costo(0.0000001)).toBe(0); });
});
