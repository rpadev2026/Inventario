import { describe, it, expect } from "vitest";
import { filtrarRecetas, type RecetaFila } from "./recetas-filtro";

let n = 0;
const R = (CodigoReceta: string | null, Nombre: string, IdEstado = 1): RecetaFila => ({ IdReceta: ++n, CodigoReceta, Nombre, RendimientoPorciones: 1, IdEstado });
const datos = [R("TIR-01", "Tira asada"), R(null, "Crema pastelera"), R("PAN-02", "Panqueque", 0), R("E2E-R1", "Salsa criolla")];

describe("filtrarRecetas", () => {
  it("sin filtros devuelve todas ordenadas por nombre", () => {
    expect(filtrarRecetas(datos, {}).map((r) => r.Nombre)).toEqual(["Crema pastelera", "Panqueque", "Salsa criolla", "Tira asada"]);
  });
  it("busca por nombre sin distinguir mayúsculas ni tildes", () => {
    expect(filtrarRecetas(datos, { q: "PASTELERA" }).map((r) => r.Nombre)).toEqual(["Crema pastelera"]);
  });
  it("busca por código", () => { expect(filtrarRecetas(datos, { q: "tir-0" }).map((r) => r.Nombre)).toEqual(["Tira asada"]); });
  it("las recetas sin código solo coinciden por nombre", () => { expect(filtrarRecetas(datos, { q: "null" })).toEqual([]); });
  it("filtra por estado", () => {
    expect(filtrarRecetas(datos, { estado: 0 }).map((r) => r.Nombre)).toEqual(["Panqueque"]);
    expect(filtrarRecetas(datos, { estado: 1 })).toHaveLength(3);
  });
});
