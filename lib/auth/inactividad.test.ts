import { describe, it, expect } from "vitest";
import { inactiva, intervaloLatidoMs, MINUTOS_DEFECTO, minutosInactividad } from "./inactividad";

describe("minutosInactividad", () => {
  it("lee los minutos de la variable de entorno", () => {
    expect(minutosInactividad("2")).toBe(2);
    expect(minutosInactividad(" 15 ")).toBe(15);
    expect(minutosInactividad("1.5")).toBe(1.5);
  });
  it("sin valor o inválido usa el valor por defecto", () => {
    for (const v of [undefined, "", "  ", "abc", "0", "-3", "0.5", "1441", "NaN", "Infinity"]) expect(minutosInactividad(v)).toBe(MINUTOS_DEFECTO);
  });
  it("acepta el máximo de un día", () => expect(minutosInactividad("1440")).toBe(1440));
});

describe("intervaloLatidoMs", () => {
  it("es un tercio del límite, entre 10 y 60 segundos", () => {
    expect(intervaloLatidoMs(1)).toBe(20_000);
    expect(intervaloLatidoMs(2)).toBe(40_000);
    expect(intervaloLatidoMs(30)).toBe(60_000); // tope
    expect(intervaloLatidoMs(1.5)).toBe(30_000);
  });
  it("siempre deja margen: el latido llega antes de que el servidor dé por inactiva la sesión", () => {
    for (const m of [1, 1.2, 2, 5, 30, 1440]) expect(intervaloLatidoMs(m)).toBeLessThan(m * 60_000);
  });
});

describe("inactiva", () => {
  const T0 = Date.UTC(2026, 10, 12, 21, 0, 0);
  it("dentro del límite no está inactiva", () => {
    expect(inactiva(T0, T0 + 119_000, 2)).toBe(false);
    expect(inactiva(T0, T0 + 120_000, 2)).toBe(false); // justo en el límite todavía vale
  });
  it("pasado el límite sí", () => expect(inactiva(T0, T0 + 120_001, 2)).toBe(true));
  it("una sesión abierta hace horas está inactiva", () => expect(inactiva(T0 - 3.75 * 3600_000, T0, 2)).toBe(true));
});
