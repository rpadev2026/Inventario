import { describe, it, expect } from "vitest";
import { opcionesCatalogo, codigoPermitido, type ItemCatalogo } from "./catalogo-opciones";

const items: ItemCatalogo[] = [
  { Codigo: "KG", Nombre: "Kilo", IdEstado: 1 },
  { Codigo: "G", Nombre: "Gramos", IdEstado: 0 },
  { Codigo: "L", Nombre: "Litro", IdEstado: 1 },
];

describe("opcionesCatalogo", () => {
  it("muestra solo vigentes", () => {
    expect(opcionesCatalogo(items).map((o) => o.codigo)).toEqual(["KG", "L"]);
  });
  it("agrega la opción actual inactiva marcada", () => {
    const o = opcionesCatalogo(items, "G");
    expect(o.map((x) => x.codigo)).toEqual(["KG", "G", "L"]);
    expect(o[1].etiqueta).toBe("Gramos (no vigente)");
  });
  it("no altera la etiqueta de la actual vigente", () => {
    expect(opcionesCatalogo(items, "KG")[0].etiqueta).toBe("Kilo");
  });
});

describe("codigoPermitido", () => {
  it("acepta vigentes", () => expect(codigoPermitido(items, "KG")).toBe(true));
  it("rechaza inexistentes", () => expect(codigoPermitido(items, "TON", "TON")).toBe(false));
  it("rechaza inactivos nuevos", () => expect(codigoPermitido(items, "G")).toBe(false));
  it("acepta inactivo si no cambia", () => expect(codigoPermitido(items, "G", "G")).toBe(true));
});
