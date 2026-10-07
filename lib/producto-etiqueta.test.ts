import { describe, it, expect } from "vitest";
import { etiquetaProducto } from "./producto-etiqueta";

describe("etiquetaProducto", () => {
  it("con código: «código — nombre»", () => expect(etiquetaProducto("HAR-01", "Harina")).toBe("HAR-01 — Harina"));
  it("sin código (null o vacío): solo el nombre", () => {
    expect(etiquetaProducto(null, "Harina")).toBe("Harina");
    expect(etiquetaProducto("", "Harina")).toBe("Harina");
  });
});
