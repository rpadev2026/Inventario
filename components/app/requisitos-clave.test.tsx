import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CampoClave from "./campo-clave";

describe("CampoClave", () => {
  const h = renderToStaticMarkup(<CampoClave label="Clave temporal" name="password" />);
  it("muestra siempre, antes de escribir, todos los requisitos de la clave", () => {
    for (const t of ["Al menos 12 caracteres", "Una letra minúscula", "Una letra mayúscula", "Un número", "Un símbolo"]) expect(h).toContain(t);
  });
  it("el máximo de 128 caracteres no se muestra mientras se cumple, para no marcar en verde algo que nadie escribió", () => {
    expect(h).not.toContain("Como máximo 128");
  });
  it("el estado no depende solo del color: cada requisito lleva texto «pendiente» para lectores de pantalla", () => {
    expect(h).toContain("Pendiente:");
  });
  it("es un campo de clave con etiqueta visible y autocompletado de clave nueva", () => {
    expect(h).toContain("Clave temporal");
    expect(h).toContain('type="password"');
    expect(h).toContain('name="password"');
    expect(h).toContain('autoComplete="new-password"');
  });
});
