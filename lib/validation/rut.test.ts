import { describe, it, expect } from "vitest";
import { validarRut, normalizarRut } from "./rut";
import { validarPolitica } from "./password";

describe("rut", () => {
  it("acepta RUT válidos", () => {
    expect(validarRut("12.345.678-5")).toBe(true);
    expect(validarRut("76.086.428-5")).toBe(true);
    expect(validarRut("11.111.111-1")).toBe(true);
  });
  it("rechaza dígito verificador incorrecto y formatos raros", () => {
    expect(validarRut("12.345.678-9")).toBe(false);
    expect(validarRut("abc")).toBe(false);
    expect(validarRut("")).toBe(false);
  });
  it("normaliza", () => expect(normalizarRut("12.345.678-5")).toBe("12345678-5"));
});

describe("politica de claves", () => {
  it("rechaza claves débiles", () => {
    expect(validarPolitica("corta1A!")).not.toBeNull();
    expect(validarPolitica("sinmayusculas123!")).not.toBeNull();
  });
  it("acepta clave fuerte", () => expect(validarPolitica("ClaveSegura#2026x")).toBeNull());
});
