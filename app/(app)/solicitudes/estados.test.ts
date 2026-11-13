import { describe, it, expect } from "vitest";
import { ESTADOS, ESTADO_TONO } from "./estados";

describe("estados de la solicitud", () => {
  it("incluye Aprobada parcialmente (6) y Cerrada (7)", () => {
    expect(ESTADOS[6]).toBe("Aprobada parcialmente");
    expect(ESTADOS[7]).toBe("Cerrada");
  });
  it("cada estado tiene su tono, y los nuevos no son verdes (no están resueltos del todo)", () => {
    expect(Object.keys(ESTADOS).sort()).toEqual(Object.keys(ESTADO_TONO).sort());
    expect(ESTADO_TONO[6]).toBe("warn");
    expect(ESTADO_TONO[7]).toBe("neutral");
  });
});
