import { describe, expect, it } from "vitest";
import { CODIGOS_PERMISO, PERMISOS, permisosEfectivos, tienePermiso } from "./permisos";

describe("permisosEfectivos", () => {
  it("Administrador recibe los 12 permisos", () => {
    const p = permisosEfectivos(["Administrador"], {});
    expect(p).toHaveLength(12);
    expect(new Set(p)).toEqual(new Set(CODIGOS_PERMISO));
    expect(PERMISOS).toHaveLength(12);
  });
  it("un rol devuelve sus permisos", () => {
    expect(permisosEfectivos(["Compras"], { Compras: ["compras.ver"] })).toEqual(["compras.ver"]);
  });
  it("une dos roles sin duplicados", () => {
    const p = permisosEfectivos(["A", "B"], { A: ["compras.ver", "productos.ver"], B: ["compras.ver", "bodegas.ver"] });
    expect([...p].sort()).toEqual(["bodegas.ver", "compras.ver", "productos.ver"]);
  });
  it("descarta códigos fuera del catálogo", () => {
    expect(permisosEfectivos(["A"], { A: ["x.y", "compras.ver"] })).toEqual(["compras.ver"]);
  });
  it("sin roles no hay permisos (revocación: se recalcula en cada lectura de sesión)", () => {
    expect(permisosEfectivos([], {})).toEqual([]);
    expect(permisosEfectivos(["Compras"], {})).toEqual([]);
  });
});

describe("tienePermiso", () => {
  it("verdadero si tiene alguno", () => {
    expect(tienePermiso(["compras.ver"], "compras.ver", "productos.ver")).toBe(true);
  });
  it("falso si no tiene ninguno", () => {
    expect(tienePermiso([], "compras.ver")).toBe(false);
  });
  it("sin requeridos es verdadero", () => {
    expect(tienePermiso([])).toBe(true);
  });
});
