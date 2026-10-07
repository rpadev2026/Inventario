import { describe, it, expect } from "vitest";
import { convertirABase, unidadDeLinea, unidadesBase, unidadesDeFamilia, type UnidadInfo } from "./unidades";

const U = (Codigo: string, UnidadBase: string, Factor: number, IdEstado = 1): UnidadInfo => ({ Codigo, Nombre: Codigo.toLowerCase(), IdEstado, UnidadBase, Factor });
const unidades = [U("G", "G", 1), U("KG", "G", 1000), U("ML", "ML", 1), U("L", "ML", 1000), U("UN", "UN", 1), U("TON", "G", 1000000, 0)];

describe("unidadesBase", () => {
  it("devuelve solo las vigentes que son su propia base", () =>
    expect(unidadesBase(unidades).map((u) => u.Codigo)).toEqual(["G", "ML", "UN"]));
});

describe("unidadesDeFamilia", () => {
  it("ofrece las vigentes de la misma familia (Gramo y Kilo, no Mililitro)", () =>
    expect(unidadesDeFamilia(unidades, "G").map((u) => u.Codigo)).toEqual(["G", "KG"]));
  it("agrega la actual aunque esté inactiva, y solo esa", () =>
    expect(unidadesDeFamilia(unidades, "G", "TON").map((u) => u.Codigo)).toEqual(["G", "KG", "TON"]));
  it("familia sin unidades → vacío", () => expect(unidadesDeFamilia(unidades, "M3")).toEqual([]));
});

describe("convertirABase", () => {
  it("5 Kilo = 5000 Gramos y 0,5 Kilo = 500", () => {
    expect(convertirABase(5, "KG", "G", unidades)).toBe(5000);
    expect(convertirABase(0.5, "KG", "G", unidades)).toBe(500);
  });
  it("la unidad base se convierte en sí misma", () => expect(convertirABase(7.5, "G", "G", unidades)).toBe(7.5));
  it("otra familia o unidad inexistente → null", () => {
    expect(convertirABase(1, "L", "G", unidades)).toBeNull();
    expect(convertirABase(1, "NOPE", "G", unidades)).toBeNull();
  });
  it("redondea a 3 decimales", () => expect(convertirABase(0.0004, "G", "G", unidades)).toBe(0));
});

describe("unidadDeLinea (unidad que se muestra y se envía en una línea de factura)", () => {
  it("la elegida, si es de la familia", () => expect(unidadDeLinea(unidades, "G", "KG")).toBe("KG"));
  it("sin elegir: la unidad base del producto", () => expect(unidadDeLinea(unidades, "G", "")).toBe("G"));
  it("sin elegir y con la base no vigente: la primera vigente de la familia, no una opción inexistente", () => {
    const sinG = unidades.map((u) => (u.Codigo === "G" ? { ...u, IdEstado: 0 } : u));
    expect(unidadDeLinea(sinG, "G", "")).toBe("KG");
  });
  it("producto sin elegir o familia sin unidades vigentes → vacío", () => {
    expect(unidadDeLinea(unidades, "", "")).toBe("");
    expect(unidadDeLinea(unidades, "M3", "")).toBe("");
  });
});
