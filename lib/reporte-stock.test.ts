import { describe, it, expect } from "vitest";
import { leerFiltrosStock, paramsStock } from "./reporte-stock";

describe("leerFiltrosStock", () => {
  it("lee bodega, texto y «solo con stock»", () => {
    expect(leerFiltrosStock({ bodega: "7", q: " harina ", con_stock: "1" })).toEqual({ bodega: 7, q: "harina", soloConStock: true });
  });
  it("ignora lo que no tiene el formato esperado", () => {
    expect(leerFiltrosStock({ bodega: "abc", con_stock: "si" })).toEqual({ bodega: undefined, q: "", soloConStock: false });
    expect(leerFiltrosStock({ bodega: "1; drop table", q: ["a", "b"] })).toEqual({ bodega: undefined, q: "", soloConStock: false });
    expect(leerFiltrosStock({ bodega: "9".repeat(40) }).bodega).toBeUndefined();
  });
  it("acota el texto a 80 caracteres", () => expect(leerFiltrosStock({ q: "x".repeat(200) }).q).toHaveLength(80));
});

describe("paramsStock", () => {
  it("omite los filtros vacíos y codifica el texto", () => {
    expect(paramsStock({ q: "", soloConStock: false })).toBe("");
    expect(paramsStock({ bodega: 3, q: "ají y sal", soloConStock: true })).toBe("bodega=3&q=aj%C3%AD+y+sal&con_stock=1");
  });
});
