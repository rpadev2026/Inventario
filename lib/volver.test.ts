import { describe, expect, it } from "vitest";
import { rutaVolverSegura } from "./volver";

describe("rutaVolverSegura", () => {
  it("acepta rutas internas", () => {
    expect(rutaVolverSegura("/compras/nueva")).toBe("/compras/nueva");
    expect(rutaVolverSegura("/compras/nueva?x=1")).toBe("/compras/nueva?x=1");
  });
  it.each(["//evil.com", "https://x", "/\\evil", "javascript:alert(1)", "", "relativa", "/a:b", "/a\nb", "/a\tb", "/a\u0000b"])("rechaza %j", (v) => {
    expect(rutaVolverSegura(v)).toBeNull();
  });
  it("rechaza null y undefined", () => {
    expect(rutaVolverSegura(null)).toBeNull();
    expect(rutaVolverSegura(undefined)).toBeNull();
  });
});
