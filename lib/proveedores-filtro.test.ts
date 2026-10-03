import { describe, it, expect } from "vitest";
import { filtrarProveedores, type ProveedorFila } from "./proveedores-filtro";

const P = (IdProveedor: number, Rut: string, RazonSocial: string, Giro: string | null = null, IdEstado = 1): ProveedorFila => ({
  IdProveedor, Rut, RazonSocial, Giro, Telefono: null, Correo: null, IdEstado,
});
const datos = [
  P(1, "76086428-5", "Distribuidora Andina SpA", "Alimentos y bebidas"),
  P(2, "76586384-8", "H Y N Inversiones SPA", "Ventas minoristas"),
  P(3, "12345678-5", "Ñandú Importaciones Ltda.", null, 0),
  P(4, "99555000-K", "Carnes del Sur", "Carnicería", 0),
  P(5, "11111111-1", "Panadería Los Álamos", "Panificación"),
];

describe("filtrarProveedores", () => {
  it("sin filtros devuelve todos ordenados por razón social", () => {
    expect(filtrarProveedores(datos, {}).map((p) => p.IdProveedor)).toEqual([4, 1, 2, 3, 5]);
  });
  it("busca por razón social sin distinguir mayúsculas ni tildes", () => {
    expect(filtrarProveedores(datos, { q: "PANADERIA" }).map((p) => p.IdProveedor)).toEqual([5]);
    expect(filtrarProveedores(datos, { q: "nandu" }).map((p) => p.IdProveedor)).toEqual([3]);
    expect(filtrarProveedores(datos, { q: "los alamos" }).map((p) => p.IdProveedor)).toEqual([5]);
  });
  it("busca por RUT con o sin puntos y guion", () => {
    expect(filtrarProveedores(datos, { q: "76086428" }).map((p) => p.IdProveedor)).toEqual([1]);
    expect(filtrarProveedores(datos, { q: "76.086.428-5" }).map((p) => p.IdProveedor)).toEqual([1]);
    expect(filtrarProveedores(datos, { q: "99555000k" }).map((p) => p.IdProveedor)).toEqual([4]);
    expect(filtrarProveedores(datos, { q: "7658" }).map((p) => p.IdProveedor)).toEqual([2]);
  });
  it("busca por giro (y tolera giro vacío)", () => {
    expect(filtrarProveedores(datos, { q: "carniceria" }).map((p) => p.IdProveedor)).toEqual([4]);
    expect(filtrarProveedores(datos, { q: "minoristas" }).map((p) => p.IdProveedor)).toEqual([2]);
    expect(filtrarProveedores(datos, { q: "ltda" }).map((p) => p.IdProveedor)).toEqual([3]);
  });
  it("filtra por estado y combina con el texto", () => {
    expect(filtrarProveedores(datos, { estado: 0 }).map((p) => p.IdProveedor)).toEqual([4, 3]);
    expect(filtrarProveedores(datos, { estado: 1 })).toHaveLength(3);
    expect(filtrarProveedores(datos, { q: "sur", estado: 0 }).map((p) => p.IdProveedor)).toEqual([4]);
    expect(filtrarProveedores(datos, { q: "sur", estado: 1 })).toEqual([]);
  });
  it("texto vacío o con espacios no filtra; sin coincidencias devuelve vacío", () => {
    expect(filtrarProveedores(datos, { q: "   " })).toHaveLength(5);
    expect(filtrarProveedores(datos, { q: "zzz" })).toEqual([]);
  });
  it("no modifica la lista original", () => {
    const copia = [...datos];
    filtrarProveedores(datos, { q: "a" });
    expect(datos).toEqual(copia);
  });
});
