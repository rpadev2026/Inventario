import { describe, it, expect } from "vitest";
import { filtrarBodegas, leerEstado, type BodegaFila } from "./bodegas-filtro";

const B = (IdBodega: number, NombreBodega: string, IdEstado = 1, EsCentral = false): BodegaFila => ({ IdBodega, NombreBodega, IdEstado, EsCentral });
const datos = [
  B(3, "Cocina Norte"), B(1, "Bodega Central", 1, true), B(4, "Cócina Sur", 0), B(2, "Barra"), B(5, "Ñandú", 0), B(6, "Terraza 2"),
];

describe("leerEstado", () => {
  it("acepta 1 y 0; cualquier otra cosa es 'todos'", () => {
    expect(leerEstado("1")).toBe(1);
    expect(leerEstado("0")).toBe(0);
    for (const v of [undefined, "", "todos", "2", "-1", "abc", ["1", "0"]]) expect(leerEstado(v), String(v)).toBeUndefined();
  });
});

describe("filtrarBodegas", () => {
  it("sin filtros devuelve todas: la Central primero y luego por nombre", () => {
    expect(filtrarBodegas(datos, {}).map((b) => b.NombreBodega)).toEqual(["Bodega Central", "Barra", "Cocina Norte", "Cócina Sur", "Ñandú", "Terraza 2"]);
  });
  it("filtra por nombre sin distinguir mayúsculas ni tildes", () => {
    expect(filtrarBodegas(datos, { q: "COCINA" }).map((b) => b.IdBodega)).toEqual([3, 4]);
    expect(filtrarBodegas(datos, { q: "nandu" }).map((b) => b.IdBodega)).toEqual([5]);
    expect(filtrarBodegas(datos, { q: "  central " }).map((b) => b.IdBodega)).toEqual([1]);
  });
  it("busca por parte del nombre y por número", () => {
    expect(filtrarBodegas(datos, { q: "terra" }).map((b) => b.IdBodega)).toEqual([6]);
    expect(filtrarBodegas(datos, { q: "2" }).map((b) => b.IdBodega)).toEqual([6]);
  });
  it("filtra por estado", () => {
    expect(filtrarBodegas(datos, { estado: 0 }).map((b) => b.IdBodega)).toEqual([4, 5]);
    expect(filtrarBodegas(datos, { estado: 1 }).map((b) => b.IdBodega)).toEqual([1, 2, 3, 6]);
  });
  it("combina nombre y estado", () => {
    expect(filtrarBodegas(datos, { q: "cocina", estado: 0 }).map((b) => b.IdBodega)).toEqual([4]);
    expect(filtrarBodegas(datos, { q: "cocina", estado: 1 }).map((b) => b.IdBodega)).toEqual([3]);
  });
  it("sin coincidencias devuelve lista vacía; q vacío no filtra", () => {
    expect(filtrarBodegas(datos, { q: "zzz" })).toEqual([]);
    expect(filtrarBodegas(datos, { q: "   " })).toHaveLength(6);
  });
  it("no modifica la lista original", () => {
    const copia = [...datos];
    filtrarBodegas(datos, { q: "a" });
    expect(datos).toEqual(copia);
  });
});
