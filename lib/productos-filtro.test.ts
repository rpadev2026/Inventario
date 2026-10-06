import { describe, it, expect } from "vitest";
import { filtrarProductos, type ProductoFila } from "./productos-filtro";

let n = 0;
const P = (Codigo: string | null, Nombre: string, IdEstado = 1): ProductoFila => ({
  IdProducto: ++n, Codigo, Nombre, UnidadMedida: "KG", Formato: "CAJA", PrecioCompra: 1000, UnidadBase: "G",
  CostoUnitarioBase: 1, StockMinimo: 10, StockCritico: 5, IdEstado,
});
const datos = [
  P("HAR-01", "Harina de trigo"), P("ACE-02", "Aceite de oliva"), P("AZU-03", "Azúcar flor", 0),
  P("E2E-P10", "Piña en almíbar"), P("CAF-04", "Café molido"), P("LEC-05", "Leche entera", 0),
];

describe("filtrarProductos", () => {
  it("sin filtros devuelve todos ordenados por nombre", () => {
    expect(filtrarProductos(datos, {}).map((p) => p.Nombre)).toEqual(
      ["Aceite de oliva", "Azúcar flor", "Café molido", "Harina de trigo", "Leche entera", "Piña en almíbar"]);
  });
  it("busca por nombre sin distinguir mayúsculas ni tildes", () => {
    expect(filtrarProductos(datos, { q: "AZUCAR" }).map((p) => p.Codigo)).toEqual(["AZU-03"]);
    expect(filtrarProductos(datos, { q: "cafe" }).map((p) => p.Codigo)).toEqual(["CAF-04"]);
    expect(filtrarProductos(datos, { q: "PIÑA en almibar" }).map((p) => p.Codigo)).toEqual(["E2E-P10"]);
  });
  it("busca también por código, en cualquier parte", () => {
    expect(filtrarProductos(datos, { q: "har-01" }).map((p) => p.Nombre)).toEqual(["Harina de trigo"]);
    expect(filtrarProductos(datos, { q: "e2e" }).map((p) => p.Codigo)).toEqual(["E2E-P10"]);
    // los guiones y puntos se ignoran al buscar: «har01» encuentra «HAR-01»
    expect(filtrarProductos(datos, { q: "har01" }).map((p) => p.Codigo)).toEqual(["HAR-01"]);
    expect(filtrarProductos(datos, { q: "e2e-p1" }).map((p) => p.Codigo)).toEqual(["E2E-P10"]);
  });
  it("filtra por estado", () => {
    expect(filtrarProductos(datos, { estado: 0 }).map((p) => p.Codigo)).toEqual(["AZU-03", "LEC-05"]);
    expect(filtrarProductos(datos, { estado: 1 })).toHaveLength(4);
  });
  it("combina texto y estado", () => {
    expect(filtrarProductos(datos, { q: "le", estado: 0 }).map((p) => p.Codigo)).toEqual(["LEC-05"]);
    expect(filtrarProductos(datos, { q: "harina", estado: 0 })).toEqual([]);
  });
  it("texto vacío o con espacios no filtra; sin coincidencias devuelve vacío", () => {
    expect(filtrarProductos(datos, { q: "   " })).toHaveLength(6);
    expect(filtrarProductos(datos, { q: "zzz" })).toEqual([]);
  });
  it("no modifica la lista original", () => {
    const copia = [...datos];
    filtrarProductos(datos, { q: "a" });
    expect(datos).toEqual(copia);
  });
  it("productos sin código se buscan por nombre y no fallan", () => {
    const con = [...datos, P(null, "Sal gruesa")];
    expect(filtrarProductos(con, { q: "sal" }).map((p) => p.Nombre)).toEqual(["Sal gruesa"]);
    expect(filtrarProductos(con, { q: "har" }).map((p) => p.Nombre)).toEqual(["Harina de trigo"]);
  });
});
