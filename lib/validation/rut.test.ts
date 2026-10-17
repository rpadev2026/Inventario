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
  // Regresión (auditoría de seguridad): un cero a la izquierda no cambia el dígito verificador, así que 1234567-4 y 01234567-4
  // pasaban como RUT distintos y evadían la unicidad de proveedores y vendedores.
  it("un RUT tiene una sola forma canónica: los ceros a la izquierda se quitan", () => {
    expect(validarRut("1.234.567-4")).toBe(true);
    expect(validarRut("01.234.567-4")).toBe(true);
    expect(normalizarRut("01.234.567-4")).toBe("1234567-4");
    expect(normalizarRut("001234567-4")).toBe(normalizarRut("1234567-4"));
    expect(normalizarRut("012345678-5")).toBe("12345678-5");
  });
  it("rechaza cuerpos que quedan cortos o vacíos al quitar los ceros", () => {
    expect(validarRut("0000000-0")).toBe(false);
    expect(validarRut("00123456-0")).toBe(false); // 6 dígitos reales
    expect(validarRut("0-0")).toBe(false);
  });
});

describe("politica de claves", () => {
  it("rechaza claves débiles", () => {
    expect(validarPolitica("corta1A!")).not.toBeNull();
    expect(validarPolitica("sinmayusculas123!")).not.toBeNull();
  });
  it("acepta clave fuerte", () => expect(validarPolitica("ClaveSegura#2026x")).toBeNull());
});
