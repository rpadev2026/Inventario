import { describe, it, expect } from "vitest";
import { hayFiltros, leerFiltrosVentasFudo, paramsFiltros } from "./ventas-fudo-filtros";

describe("leerFiltrosVentasFudo", () => {
  it("sin parámetros no hay filtros", () => {
    const f = leerFiltrosVentasFudo({});
    expect(f).toEqual({ desde: "", hasta: "", q: "", motivo: "" });
    expect(hayFiltros(f)).toBe(false);
  });
  it("lee fechas, producto y motivo", () => {
    expect(leerFiltrosVentasFudo({ desde: "2026-10-01", hasta: "2026-10-31", q: "  pizza ", motivo: "sin receta" }))
      .toEqual({ desde: "2026-10-01", hasta: "2026-10-31", q: "pizza", motivo: "sin receta" });
  });
  it("ignora fechas imposibles y motivos desconocidos", () => {
    expect(leerFiltrosVentasFudo({ desde: "2026-02-31", hasta: "ayer", motivo: "otro" })).toEqual({ desde: "", hasta: "", q: "", motivo: "" });
  });
  it("intercambia fechas al revés y acota el texto", () => {
    const f = leerFiltrosVentasFudo({ desde: "2026-10-31", hasta: "2026-10-01", q: "x".repeat(200) });
    expect([f.desde, f.hasta, f.q.length]).toEqual(["2026-10-01", "2026-10-31", 80]);
  });
  it("ignora valores que no son texto (listas repetidas en la URL)", () => {
    expect(leerFiltrosVentasFudo({ q: ["a", "b"], desde: ["2026-10-01"] })).toEqual({ desde: "", hasta: "", q: "", motivo: "" });
  });
});

describe("paramsFiltros", () => {
  it("incluye solo los filtros con valor, más los extra", () => {
    expect(paramsFiltros({ desde: "2026-10-01", hasta: "", q: "a b", motivo: "" }, { tipo: "ventas" })).toBe("tipo=ventas&desde=2026-10-01&q=a+b");
  });
});
