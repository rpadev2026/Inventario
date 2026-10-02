import { describe, expect, it } from "vitest";
import { filtrarOpciones, normalizar, type Opcion } from "./buscar";

const opciones: Opcion[] = [
  { valor: "1", etiqueta: "Distribuidora Andina (76.086.428-5)", busqueda: "Distribuidora Andina 76.086.428-5" },
  { valor: "2", etiqueta: "Frutería Ñuñoa (11.111.111-1)", busqueda: "Frutería Ñuñoa 11.111.111-1" },
  { valor: "3", etiqueta: "HAR-001 Harina 25 kg", busqueda: "HAR-001 Harina 25 kg" },
  { valor: "4", etiqueta: "Aceite 5 L", busqueda: "ACE-002 Aceite 5 L" },
];

describe("normalizar", () => {
  it("minúsculas, sin tildes, puntos ni guiones y espacios simples", () => {
    expect(normalizar("  Frutería   Ñuñoa 76.086.428-5 ")).toBe("fruteria nunoa 760864285");
  });
});

describe("filtrarOpciones", () => {
  it("encuentra por RUT sin puntos", () => {
    expect(filtrarOpciones(opciones, "76086428").map((o) => o.valor)).toEqual(["1"]);
  });
  it("encuentra por nombre sin tildes ni mayúsculas", () => {
    expect(filtrarOpciones(opciones, "DISTRIBUIDORA").map((o) => o.valor)).toEqual(["1"]);
    expect(filtrarOpciones(opciones, "fruteria").map((o) => o.valor)).toEqual(["2"]);
  });
  it("encuentra por código de producto y por texto", () => {
    expect(filtrarOpciones(opciones, "har001").map((o) => o.valor)).toEqual(["3"]);
    expect(filtrarOpciones(opciones, "ace-002").map((o) => o.valor)).toEqual(["4"]);
    expect(filtrarOpciones(opciones, "aceite").map((o) => o.valor)).toEqual(["4"]);
  });
  it("texto vacío devuelve las primeras max", () => {
    expect(filtrarOpciones(opciones, "", 2).map((o) => o.valor)).toEqual(["1", "2"]);
    expect(filtrarOpciones(opciones, "   ").length).toBe(4);
  });
  it("respeta max", () => {
    const muchas = Array.from({ length: 20 }, (_, i) => ({ valor: String(i), etiqueta: `Item ${i}`, busqueda: `item ${i}` }));
    expect(filtrarOpciones(muchas, "item")).toHaveLength(8);
    expect(filtrarOpciones(muchas, "item", 3)).toHaveLength(3);
  });
  it("sin coincidencias devuelve vacío", () => {
    expect(filtrarOpciones(opciones, "zzz")).toEqual([]);
  });
});
