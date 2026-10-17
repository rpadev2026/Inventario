import { describe, it, expect } from "vitest";
import { atajos, etiquetaPeriodo, hoyChile, leerAgrupacion, leerRango, paramsRango, sumarDias } from "./reporte-ventas";

// 2026-10-17 15:00 en Chile (UTC-3)
const AHORA = new Date("2026-10-17T18:00:00Z");

describe("hoyChile", () => {
  it("usa la fecha de Chile, no la de UTC", () => {
    expect(hoyChile(AHORA)).toBe("2026-10-17");
    expect(hoyChile(new Date("2026-10-18T01:30:00Z"))).toBe("2026-10-17"); // 22:30 del 17 en Chile
  });
});

describe("sumarDias", () => {
  it("cruza meses y años", () => {
    expect(sumarDias("2026-10-01", -1)).toBe("2026-09-30");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2026-10-17", -29)).toBe("2026-09-18");
  });
});

describe("leerRango", () => {
  it("lee desde y hasta", () => expect(leerRango({ desde: "2026-10-01", hasta: "2026-10-15" }, AHORA)).toEqual({ desde: "2026-10-01", hasta: "2026-10-15" }));
  it("sin parámetros: los últimos 30 días hasta hoy", () => expect(leerRango({}, AHORA)).toEqual({ desde: "2026-09-18", hasta: "2026-10-17" }));
  it("ignora lo inválido (formato o fecha inexistente)", () => {
    expect(leerRango({ desde: "ayer", hasta: "2026-02-31" }, AHORA)).toEqual({ desde: "2026-09-18", hasta: "2026-10-17" });
    expect(leerRango({ desde: "2026-1-1" }, AHORA)).toEqual({ desde: "2026-09-18", hasta: "2026-10-17" });
    expect(leerRango({ desde: ["2026-10-01"] }, AHORA).desde).toBe("2026-09-18");
  });
  it("si vienen al revés las intercambia", () => expect(leerRango({ desde: "2026-10-15", hasta: "2026-10-01" }, AHORA)).toEqual({ desde: "2026-10-01", hasta: "2026-10-15" }));
  it("solo hasta: 30 días hacia atrás desde esa fecha", () => expect(leerRango({ hasta: "2026-10-31" }, AHORA)).toEqual({ desde: "2026-10-02", hasta: "2026-10-31" }));
});

describe("leerAgrupacion", () => {
  it("acepta día, semana y mes; el resto es día", () => {
    expect(leerAgrupacion({ agrupar: "semana" })).toBe("semana");
    expect(leerAgrupacion({ agrupar: "mes" })).toBe("mes");
    expect(leerAgrupacion({ agrupar: "año" })).toBe("dia");
    expect(leerAgrupacion({})).toBe("dia");
  });
});

describe("paramsRango y atajos", () => {
  it("arma la consulta sin vacíos", () => {
    expect(paramsRango({ desde: "2026-10-01", hasta: "2026-10-15" }, { agrupar: "mes", q: "" })).toBe("desde=2026-10-01&hasta=2026-10-15&agrupar=mes");
  });
  it("los atajos de rango", () => {
    const a = Object.fromEntries(atajos(AHORA).map((x) => [x.nombre, x.rango]));
    expect(a["Hoy"]).toEqual({ desde: "2026-10-17", hasta: "2026-10-17" });
    expect(a["Últimos 7 días"]).toEqual({ desde: "2026-10-11", hasta: "2026-10-17" });
    expect(a["Este mes"]).toEqual({ desde: "2026-10-01", hasta: "2026-10-17" });
    expect(a["Mes anterior"]).toEqual({ desde: "2026-09-01", hasta: "2026-09-30" });
  });
  it("«Mes anterior» desde enero cae en diciembre del año anterior", () => {
    const a = Object.fromEntries(atajos(new Date("2027-01-10T15:00:00Z")).map((x) => [x.nombre, x.rango]));
    expect(a["Mes anterior"]).toEqual({ desde: "2026-12-01", hasta: "2026-12-31" });
  });
});

describe("etiquetaPeriodo", () => {
  it("día con su día de la semana", () => expect(etiquetaPeriodo("2026-10-05", "dia")).toBe("lun 05-10-2026"));
  it("semana de lunes a domingo", () => expect(etiquetaPeriodo("2026-10-05", "semana")).toBe("Semana 05-10-2026 al 11-10-2026"));
  it("mes con su nombre", () => expect(etiquetaPeriodo("2026-10-01", "mes")).toBe("octubre de 2026"));
});
