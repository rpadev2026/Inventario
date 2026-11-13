import { describe, it, expect, vi } from "vitest";
vi.mock("@/app/(app)/push/actions", () => ({ suscribirPush: vi.fn(), desuscribirPush: vi.fn() }));
import { renderToStaticMarkup } from "react-dom/server";
import ActivarAvisos from "./activar-avisos";

describe("ActivarAvisos", () => {
  it("antes de hidratar muestra la sección con título y un texto de estado accesible (sin botón engañoso)", () => {
    const h = renderToStaticMarkup(<ActivarAvisos clavePublica="abc" />);
    expect(h).toContain("Avisos en este dispositivo");
    expect(h).toContain('aria-live="polite"');
  });
});
