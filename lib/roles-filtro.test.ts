import { describe, it, expect } from "vitest";
import { filtrarRoles, type RolFila } from "./roles-filtro";

const R = (IdRol: number, NombreRol: string, DetalleRol: string | null, IdEstado = 1, EsBase = false): RolFila => ({ IdRol, NombreRol, DetalleRol, IdEstado, EsBase });
const datos = [
  R(1, "Administrador", "Gestiona usuarios, roles y todo el sistema", 1, true),
  R(2, "Compras", "Registra facturas, proveedores y productos", 0, true),
  R(3, "Bodeguero Central", "Aprueba y despacha solicitudes", 0, true),
  R(4, "Solicitante", null, 1, true),
  R(10, "Auditoría", "Solo lectura de facturas", 1),
];

describe("filtrarRoles", () => {
  it("sin filtros devuelve todos en el orden de creación (los base primero)", () => {
    expect(filtrarRoles(datos, {}).map((r) => r.IdRol)).toEqual([1, 2, 3, 4, 10]);
  });
  it("busca por nombre sin distinguir mayúsculas ni tildes", () => {
    expect(filtrarRoles(datos, { q: "AUDITORIA" }).map((r) => r.IdRol)).toEqual([10]);
    expect(filtrarRoles(datos, { q: "bodeguero" }).map((r) => r.IdRol)).toEqual([3]);
  });
  it("busca también en el detalle y tolera detalle vacío", () => {
    expect(filtrarRoles(datos, { q: "facturas" }).map((r) => r.IdRol)).toEqual([2, 10]);
    expect(filtrarRoles(datos, { q: "solicitante" }).map((r) => r.IdRol)).toEqual([4]);
  });
  it("filtra por estado y lo combina con el texto", () => {
    expect(filtrarRoles(datos, { estado: 0 }).map((r) => r.IdRol)).toEqual([2, 3]);
    expect(filtrarRoles(datos, { estado: 1 }).map((r) => r.IdRol)).toEqual([1, 4, 10]);
    expect(filtrarRoles(datos, { q: "facturas", estado: 1 }).map((r) => r.IdRol)).toEqual([10]);
    expect(filtrarRoles(datos, { q: "administrador", estado: 0 })).toEqual([]);
  });
  it("texto vacío no filtra; sin coincidencias devuelve vacío; no modifica la lista", () => {
    expect(filtrarRoles(datos, { q: "  " })).toHaveLength(5);
    expect(filtrarRoles(datos, { q: "zzz" })).toEqual([]);
    const copia = [...datos];
    filtrarRoles(datos, { q: "a" });
    expect(datos).toEqual(copia);
  });
});
