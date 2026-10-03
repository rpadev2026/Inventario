import { describe, it, expect } from "vitest";
import { paginar, TAMANOS, TAM_DEFECTO } from "./paginacion";

describe("paginar", () => {
  it("usa 10 por defecto y las opciones son 10, 25, 50, 75 y 100", () => {
    expect(TAM_DEFECTO).toBe(10);
    expect([...TAMANOS]).toEqual([10, 25, 50, 75, 100]);
    expect(paginar({}, 140)).toMatchObject({ pagina: 1, tam: 10, totalPaginas: 14, desde: 1, hasta: 10, from: 0, to: 9 });
  });
  it("acepta los tamaños permitidos (también como texto de la URL)", () => {
    for (const t of [10, 25, 50, 75, 100]) expect(paginar({ tam: String(t) }, 500).tam).toBe(t);
    expect(paginar({ tam: 75 }, 500).tam).toBe(75);
  });
  it("un tamaño no permitido o ilegible vuelve a 10", () => {
    for (const t of ["5", "30", "101", "0", "-10", "abc", "", "10.5", undefined, null, ["50", "75"]])
      expect(paginar({ tam: t }, 500).tam, String(t)).toBe(10);
  });
  it("calcula el rango de la página pedida", () => {
    expect(paginar({ pagina: "2", tam: "50" }, 140)).toMatchObject({ pagina: 2, desde: 51, hasta: 100, from: 50, to: 99 });
    expect(paginar({ pagina: "3" }, 140)).toMatchObject({ pagina: 3, desde: 21, hasta: 30, from: 20, to: 29 });
  });
  it("la última página puede ser parcial", () => {
    expect(paginar({ pagina: "6", tam: "25" }, 140)).toMatchObject({ pagina: 6, desde: 126, hasta: 140, from: 125, to: 149 });
    expect(paginar({ pagina: "7" }, 63)).toMatchObject({ pagina: 7, desde: 61, hasta: 63 });
  });
  it("una página fuera de rango se ajusta a la última; inválida, a la primera", () => {
    expect(paginar({ pagina: "99" }, 140).pagina).toBe(14);
    for (const p of ["0", "-3", "abc", "", "1.5", undefined]) expect(paginar({ pagina: p }, 140).pagina, String(p)).toBe(1);
  });
  it("sin registros: una sola página vacía", () => {
    expect(paginar({ pagina: "3" }, 0)).toMatchObject({ pagina: 1, totalPaginas: 1, desde: 0, hasta: 0, total: 0 });
  });
  it("exactamente un múltiplo del tamaño no crea una página vacía", () => {
    expect(paginar({ pagina: "9", tam: "25" }, 50)).toMatchObject({ pagina: 2, totalPaginas: 2, desde: 26, hasta: 50 });
    expect(paginar({ pagina: "9" }, 30)).toMatchObject({ pagina: 3, totalPaginas: 3, desde: 21, hasta: 30 });
  });
});
