import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("./actions", () => ({ rechazarSolicitud: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import FormRechazar from "./form-rechazar";

describe("FormRechazar", () => {
  const h = renderToStaticMarkup(<FormRechazar id={5} />);
  it("pide el motivo con etiqueta visible, obligatorio y con tope de 100 caracteres", () => {
    expect(h).toContain("Motivo del rechazo");
    expect(h).toContain("required");
    expect(h).toContain('maxLength="100"');
    expect(h).toContain('name="motivo"');
  });
  it("muestra el contador de caracteres y la regla antes de escribir", () => {
    expect(h).toContain("0/100");
    expect(h).toContain("Obligatorio");
  });
  it("lleva el id de la solicitud y el botón de peligro", () => {
    expect(h).toContain('name="id"');
    expect(h).toContain('value="5"');
    expect(h).toContain("btn btn-danger");
    expect(h).toContain("Rechazar solicitud");
  });
});
