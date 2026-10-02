import { describe, it, expect } from "vitest";
import { opcionesRegion, opcionesCiudad, opcionesComuna, errorTerritorio, type Territorio } from "./territorio-opciones";

const t: Territorio = {
  regiones: [
    { Codigo: "13", Nombre: "Metropolitana", IdEstado: 1 },
    { Codigo: "05", Nombre: "Valparaíso", IdEstado: 1 },
  ],
  ciudades: [
    { Codigo: "132", Nombre: "Chacabuco", IdEstado: 1, CodigoRegion: "13" },
    { Codigo: "131", Nombre: "Santiago", IdEstado: 1, CodigoRegion: "13" },
    { Codigo: "051", Nombre: "Valparaíso", IdEstado: 1, CodigoRegion: "05" },
  ],
  comunas: [
    { Codigo: "13101", Nombre: "Santiago", IdEstado: 1, CodigoProvincia: "131" },
    { Codigo: "13102", Nombre: "Antigua", IdEstado: 0, CodigoProvincia: "131" },
    { Codigo: "13201", Nombre: "Colina", IdEstado: 1, CodigoProvincia: "132" },
    { Codigo: "05101", Nombre: "Valparaíso", IdEstado: 1, CodigoProvincia: "051" },
  ],
};
const vacio = { region: null, ciudad: null, comuna: null };

describe("opciones", () => {
  it("regiones ordenadas por nombre", () => {
    expect(opcionesRegion(t, null).map((o) => o.valor)).toEqual(["13", "05"]);
  });
  it("ciudad vacía sin región", () => expect(opcionesCiudad(t, null, null)).toEqual([]));
  it("solo ciudades de la región, ordenadas", () => {
    expect(opcionesCiudad(t, "13", null).map((o) => o.valor)).toEqual(["132", "131"]);
  });
  it("comuna vacía sin ciudad", () => expect(opcionesComuna(t, null, null)).toEqual([]));
  it("inactiva solo si es actual, marcada", () => {
    expect(opcionesComuna(t, "131", null).map((o) => o.valor)).toEqual(["13101"]);
    const o = opcionesComuna(t, "131", "13102");
    expect(o.map((x) => x.valor)).toEqual(["13102", "13101"]);
    expect(o[0].etiqueta).toBe("Antigua (no vigente)");
  });
});

describe("errorTerritorio", () => {
  it("null para vacío, solo región y combinación válida", () => {
    expect(errorTerritorio(t, vacio, vacio)).toBeNull();
    expect(errorTerritorio(t, { ...vacio, region: "13" }, vacio)).toBeNull();
    expect(errorTerritorio(t, { region: "13", ciudad: "131", comuna: "13101" }, vacio)).toBeNull();
  });
  it("mensajes", () => {
    expect(errorTerritorio(t, { region: "13", ciudad: null, comuna: "13101" }, vacio)).toBe("La comuna requiere ciudad");
    expect(errorTerritorio(t, { region: null, ciudad: "131", comuna: null }, vacio)).toBe("La ciudad requiere región");
    expect(errorTerritorio(t, { region: "13", ciudad: "131", comuna: "13201" }, vacio)).toBe("La comuna no pertenece a la ciudad");
    expect(errorTerritorio(t, { region: "13", ciudad: "051", comuna: null }, vacio)).toBe("La ciudad no pertenece a la región");
    expect(errorTerritorio(t, { region: "99", ciudad: null, comuna: null }, vacio)).toBe("Región no válida");
    expect(errorTerritorio(t, { region: "13", ciudad: "999", comuna: null }, vacio)).toBe("Ciudad no válida");
    expect(errorTerritorio(t, { region: "13", ciudad: "131", comuna: "99999" }, vacio)).toBe("Comuna no válida");
    expect(errorTerritorio(t, { region: "13", ciudad: "131", comuna: "13102" }, vacio)).toBe("Comuna no válida");
  });
  it("comuna inactiva igual a la actual es válida", () => {
    const s = { region: "13", ciudad: "131", comuna: "13102" };
    expect(errorTerritorio(t, s, s)).toBeNull();
  });
});
