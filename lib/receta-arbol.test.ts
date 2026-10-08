import { describe, it, expect } from "vitest";
import { recetasQueContienen } from "./receta-arbol";

// Aristas «receta contiene sub-receta»: 1 → 2 → 3, 4 → 3, 5 sola.
const pares = [{ receta: 1, sub: 2 }, { receta: 2, sub: 3 }, { receta: 4, sub: 3 }];

describe("recetasQueContienen", () => {
  it("incluye a las que la usan directa o indirectamente", () => {
    expect([...recetasQueContienen(3, pares)].sort()).toEqual([1, 2, 4]);
    expect([...recetasQueContienen(2, pares)]).toEqual([1]);
  });
  it("una receta que nadie usa no tiene ancestros", () => {
    expect([...recetasQueContienen(1, pares)]).toEqual([]);
    expect([...recetasQueContienen(5, pares)]).toEqual([]);
  });
  it("termina aunque los datos tengan un ciclo", () => {
    expect([...recetasQueContienen(1, [{ receta: 1, sub: 2 }, { receta: 2, sub: 1 }])].sort()).toEqual([1, 2]);
  });
});
