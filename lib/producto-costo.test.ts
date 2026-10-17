import { describe, it, expect } from "vitest";
import { costoCompraVisible } from "./producto-costo";

describe("costo de compra en los buscadores de productos", () => {
  // Regresión (auditoría de seguridad): el rol Solicitante recibía el costo de todo el catálogo.
  it("el Solicitante (solo solicitudes y bodegas) no lo recibe", () => {
    const solicitante = ["solicitudes.ver_propias", "solicitudes.crear", "bodegas.ver"];
    expect(costoCompraVisible(1.5, solicitante)).toBeNull();
    expect(costoCompraVisible("1.500000", solicitante)).toBeNull();
  });
  it("quien arma recetas sí lo recibe, como número", () => {
    expect(costoCompraVisible(1.5, ["recetas.gestionar"])).toBe(1.5);
    expect(costoCompraVisible("0.123456", ["recetas.ver", "recetas.gestionar"])).toBe(0.123456);
  });
  it("sin costo (producto sin facturas) sigue siendo null para todos", () => {
    expect(costoCompraVisible(null, ["recetas.gestionar"])).toBeNull();
    expect(costoCompraVisible(null, [])).toBeNull();
  });
  it("otros permisos de compras o productos no lo habilitan por sí solos", () => {
    expect(costoCompraVisible(2, ["compras.registrar", "productos.ver"])).toBeNull();
    expect(costoCompraVisible(2, [])).toBeNull();
  });
});
