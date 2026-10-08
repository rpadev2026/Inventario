import { describe, expect, it } from "vitest";
import { agruparPermisos, permisosEfectivos, tienePermiso } from "./permisos";

const CATALOGO = ["compras.ver", "productos.ver", "bodegas.ver"];

describe("permisosEfectivos", () => {
  it("Administrador recibe todos los permisos del catálogo (que viene de la tabla Permisos)", () => {
    expect(permisosEfectivos(["Administrador"], {}, CATALOGO)).toEqual(CATALOGO);
  });
  it("un rol devuelve sus permisos", () => {
    expect(permisosEfectivos(["Compras"], { Compras: ["compras.ver"] })).toEqual(["compras.ver"]);
  });
  it("une dos roles sin duplicados", () => {
    const p = permisosEfectivos(["A", "B"], { A: ["compras.ver", "productos.ver"], B: ["compras.ver", "bodegas.ver"] });
    expect([...p].sort()).toEqual(["bodegas.ver", "compras.ver", "productos.ver"]);
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

describe("agruparPermisos", () => {
  const cat = [
    { codigo: "compras.ver", modulo: "Compras", descripcion: "Ver facturas" },
    { codigo: "compras.anular", modulo: "Compras", descripcion: "Anular facturas" },
    { codigo: "bodegas.ver", modulo: "Bodegas", descripcion: "Ver bodegas" },
  ];
  it("agrupa por módulo conservando el orden del catálogo", () => {
    expect(agruparPermisos(cat).map((g) => [g.modulo, g.permisos.map((p) => p.codigo)])).toEqual(
      [["Compras", ["compras.ver", "compras.anular"]], ["Bodegas", ["bodegas.ver"]]]);
  });
  it("sin permisos devuelve una lista vacía", () => { expect(agruparPermisos([])).toEqual([]); });
});
