import { describe, it, expect } from "vitest";
import { filtrarDecimal, filtrarDecimal2, filtrarDecimalComa, parseCantidad, parseDecimal2, soloDigitos } from "./numeros";

describe("parseDecimal2", () => {
  it("acepta coma o punto como decimal", () => {
    expect(parseDecimal2("1,5")).toBe(1.5);
    expect(parseDecimal2("1.25")).toBe(1.25);
    expect(parseDecimal2("10")).toBe(10);
  });
  it("rechaza 3 decimales, vacío, negativo y notación científica", () => {
    expect(parseDecimal2("1,555")).toBeNull();
    expect(parseDecimal2("")).toBeNull();
    expect(parseDecimal2("-1")).toBeNull();
    expect(parseDecimal2("1e3")).toBeNull();
    expect(parseDecimal2("1.234")).toBeNull();
  });
});
describe("filtrarDecimal2", () => {
  it("conserva dígitos y un separador con máximo 2 decimales", () => {
    expect(filtrarDecimal2("12a,3456")).toBe("12,34");
    expect(filtrarDecimal2("1.2.3")).toBe("1.2");
  });
});
describe("soloDigitos", () => {
  it("quita lo que no es dígito", () => expect(soloDigitos("1a2-3")).toBe("123"));
});

describe("filtrarDecimal", () => {
  it("permite hasta 3 decimales y un solo separador", () => {
    expect(filtrarDecimal("1,2345", 3)).toBe("1,234");
    expect(filtrarDecimal("a1.5b.7", 3)).toBe("1.5");
    expect(filtrarDecimal("0,", 3)).toBe("0,");
    expect(filtrarDecimal("12", 0)).toBe("12");
    expect(filtrarDecimal("12,5", 0)).toBe("12,");
  });
});
describe("parseCantidad", () => {
  it("acepta hasta 3 decimales mayores que cero", () => {
    expect(parseCantidad("2,5")).toBe(2.5);
    expect(parseCantidad("0.001")).toBe(0.001);
    expect(parseCantidad("10")).toBe(10);
  });
  it("rechaza vacío, cero, 4 decimales y negativos", () => {
    expect(parseCantidad("")).toBeNull();
    expect(parseCantidad("0")).toBeNull();
    expect(parseCantidad("0,000")).toBeNull();
    expect(parseCantidad("1,2345")).toBeNull();
    expect(parseCantidad("-1")).toBeNull();
  });
});

describe("filtrarDecimalComa (precios: el punto es separador de miles, no decimal)", () => {
  it("descarta el punto: «1.500» queda 1500", () => expect(filtrarDecimalComa("1.500", 2)).toBe("1500"));
  it("la coma es el decimal, con tope de decimales", () => {
    expect(filtrarDecimalComa("1500,5", 2)).toBe("1500,5");
    expect(filtrarDecimalComa("1.500,567", 2)).toBe("1500,56");
  });
  it("ignora letras y una segunda coma", () => {
    expect(filtrarDecimalComa("12a", 2)).toBe("12");
    expect(filtrarDecimalComa("1,2,3", 2)).toBe("1,2");
  });
});
