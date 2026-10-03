import { describe, it, expect } from "vitest";
import { filtrarUsuarios, type UsuarioFila } from "./usuarios-filtro";

const U = (IdUsuario: number, Rut: string, Nombres: string, Apellidos: string, Correo: string, IdEstado = 1): UsuarioFila => ({ IdUsuario, Rut, Nombres, Apellidos, Correo, IdEstado });
const datos = [
  U(1, "12345678-5", "Ana María", "Pérez Soto", "ana.perez@empresa.cl"),
  U(2, "76086428-5", "Carlos", "Álvarez Núñez", "carlos@empresa.cl", 0),
  U(3, "99555000-K", "Beatriz", "Muñoz", "bmunoz@otra.com"),
  U(4, "11111111-1", "José", "Pérez Araya", "jose.perez@empresa.cl", 0),
];

describe("filtrarUsuarios", () => {
  it("sin filtros devuelve todos, ordenados por apellidos y nombres", () => {
    expect(filtrarUsuarios(datos, {}).map((u) => u.IdUsuario)).toEqual([2, 3, 4, 1]);
  });
  it("busca por nombre o apellido sin distinguir mayúsculas ni tildes", () => {
    expect(filtrarUsuarios(datos, { q: "MUNOZ" }).map((u) => u.IdUsuario)).toEqual([3]);
    expect(filtrarUsuarios(datos, { q: "alvarez" }).map((u) => u.IdUsuario)).toEqual([2]);
    expect(filtrarUsuarios(datos, { q: "ana maria" }).map((u) => u.IdUsuario)).toEqual([1]);
  });
  it("busca por nombre completo (nombres + apellidos)", () => {
    expect(filtrarUsuarios(datos, { q: "maría pérez" }).map((u) => u.IdUsuario)).toEqual([1]);
    expect(filtrarUsuarios(datos, { q: "jose perez araya" }).map((u) => u.IdUsuario)).toEqual([4]);
  });
  it("busca por RUT con o sin puntos y guion", () => {
    expect(filtrarUsuarios(datos, { q: "76086428" }).map((u) => u.IdUsuario)).toEqual([2]);
    expect(filtrarUsuarios(datos, { q: "12.345.678-5" }).map((u) => u.IdUsuario)).toEqual([1]);
    expect(filtrarUsuarios(datos, { q: "99555000k" }).map((u) => u.IdUsuario)).toEqual([3]);
  });
  it("busca por correo (o parte del dominio)", () => {
    expect(filtrarUsuarios(datos, { q: "otra.com" }).map((u) => u.IdUsuario)).toEqual([3]);
    expect(filtrarUsuarios(datos, { q: "perez@empresa" }).map((u) => u.IdUsuario)).toEqual([4, 1]);
  });
  it("filtra por estado y lo combina con el texto", () => {
    expect(filtrarUsuarios(datos, { estado: 0 }).map((u) => u.IdUsuario)).toEqual([2, 4]);
    expect(filtrarUsuarios(datos, { estado: 1 }).map((u) => u.IdUsuario)).toEqual([3, 1]);
    expect(filtrarUsuarios(datos, { q: "perez", estado: 0 }).map((u) => u.IdUsuario)).toEqual([4]);
    expect(filtrarUsuarios(datos, { q: "carlos", estado: 1 })).toEqual([]);
  });
  it("texto vacío o con espacios no filtra; sin coincidencias devuelve vacío", () => {
    expect(filtrarUsuarios(datos, { q: "   " })).toHaveLength(4);
    expect(filtrarUsuarios(datos, { q: "zzz" })).toEqual([]);
  });
  it("no modifica la lista original", () => {
    const copia = [...datos];
    filtrarUsuarios(datos, { q: "a" });
    expect(datos).toEqual(copia);
  });
});
