import { describe, it, expect } from "vitest";
import { construirHref } from "./href";

const href = (q: Record<string, string | undefined>) => construirHref("/productos", "/productos/nuevo", q);

describe("construirHref", () => {
  it("sin parámetros devuelve la raíz", () => expect(href({})).toBe("/productos"));
  it("omite los undefined y conserva el resto", () => expect(href({ q: "sal", pagina: undefined, tam: "25" })).toBe("/productos?q=sal&tam=25"));
  // La creación vive en su propia ruta: la URL no lleva «?crear=1».
  it("crear: '1' va a la ruta de creación y no aparece en la URL", () => {
    expect(href({ crear: "1" })).toBe("/productos/nuevo");
    expect(href({ crear: "1" })).not.toContain("crear");
  });
  it("la ruta de creación conserva página y filtros (para el botón Volver)", () => {
    expect(href({ pagina: "2", tam: "25", q: "sal", crear: "1" })).toBe("/productos/nuevo?pagina=2&tam=25&q=sal");
  });
  it("cualquier otro valor de crear se trata como el listado", () => expect(href({ crear: "0" })).toBe("/productos"));
  it("codifica los valores", () => expect(href({ q: "a b&c" })).toBe("/productos?q=a+b%26c"));
});
