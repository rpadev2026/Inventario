import { describe, it, expect } from "vitest";
import { hayCambioDeCantidades } from "./aprobacion-parcial";

const items = [{ producto: 1, solicitada: 100 }, { producto: 2, solicitada: 50 }];

describe("hayCambioDeCantidades", () => {
  it("sin cambios (todo igual a lo solicitado) es false", () => {
    expect(hayCambioDeCantidades(items, { "1": "100", "2": "50" })).toBe(false);
    expect(hayCambioDeCantidades(items, { "1": "100.000", "2": "50,0".replace(",", ".") })).toBe(false);
  });
  it("cualquier producto con otra cantidad es true", () => {
    expect(hayCambioDeCantidades(items, { "1": "40", "2": "50" })).toBe(true);
    expect(hayCambioDeCantidades(items, { "1": "100", "2": "0" })).toBe(true);
  });
  it("un valor vacío o no numérico cuenta como 0 (cambio)", () => {
    expect(hayCambioDeCantidades(items, { "1": "", "2": "50" })).toBe(true);
    expect(hayCambioDeCantidades(items, { "1": "abc", "2": "50" })).toBe(true);
  });
  it("un producto sin valor en el formulario cuenta como 0", () => {
    expect(hayCambioDeCantidades(items, { "1": "100" })).toBe(true);
  });
  it("se compara con lo SOLICITADO, no con el máximo que permite el stock", () => {
    expect(hayCambioDeCantidades([{ producto: 1, solicitada: 100 }], { "1": "60" })).toBe(true); // aunque 60 fuera el máximo disponible
  });
  it("sin productos no hay cambio", () => expect(hayCambioDeCantidades([], {})).toBe(false));
});
