import { describe, it, expect } from "vitest";
import { textoUso } from "./uso";

describe("textoUso", () => {
  it("usa singular y plural según la cantidad", () => {
    expect(textoUso(0, "factura", "facturas")).toBe("0 facturas");
    expect(textoUso(1, "factura", "facturas")).toBe("1 factura");
    expect(textoUso(12, "factura", "facturas")).toBe("12 facturas");
  });
  it("agrega cuántos están vigentes cuando se informa", () => {
    expect(textoUso(12, "ciudad", "ciudades", 10)).toBe("12 ciudades (10 vigentes)");
    expect(textoUso(3, "comuna", "comunas", 1)).toBe("3 comunas (1 vigente)");
    expect(textoUso(0, "producto", "productos", 0)).toBe("0 productos (0 vigentes)");
  });
  it("formatea los miles con punto, como en el resto de la aplicación", () => {
    expect(textoUso(1234, "producto", "productos")).toBe("1.234 productos");
  });
});
