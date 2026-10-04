import { describe, it, expect } from "vitest";
import { filtrarCatalogo, type ItemFila } from "./catalogo-filtro";

const I = (Codigo: string, Nombre: string, IdEstado = 1, padre?: string): ItemFila => ({ Codigo, Nombre, IdEstado, padre });
const datos = [
  I("13101", "Santiago", 1, "Santiago (Metropolitana de Santiago)"),
  I("05101", "Valparaíso", 1, "Valparaíso (Valparaíso)"),
  I("13123", "Providencia", 0, "Santiago (Metropolitana de Santiago)"),
  I("16101", "Chillán", 1, "Diguillín (Ñuble)"),
  I("16303", "Ñiquén", 0, "Punilla (Ñuble)"),
];

describe("filtrarCatalogo", () => {
  it("sin filtros devuelve todos ordenados por nombre (la Ñ va después de la N)", () => {
    expect(filtrarCatalogo(datos, {}).map((i) => i.Codigo)).toEqual(["16101", "16303", "13123", "13101", "05101"]);
  });
  it("busca por nombre sin distinguir mayúsculas ni tildes", () => {
    expect(filtrarCatalogo(datos, { q: "CHILLAN" }).map((i) => i.Codigo)).toEqual(["16101"]);
    expect(filtrarCatalogo(datos, { q: "niquen" }).map((i) => i.Codigo)).toEqual(["16303"]);
    expect(filtrarCatalogo(datos, { q: "valpara" }).map((i) => i.Codigo)).toEqual(["05101"]);
  });
  it("busca por código", () => {
    expect(filtrarCatalogo(datos, { q: "13123" }).map((i) => i.Codigo)).toEqual(["13123"]);
    expect(filtrarCatalogo(datos, { q: "161" }).map((i) => i.Codigo)).toEqual(["16101"]);
  });
  it("busca también por el nombre del padre (región o ciudad)", () => {
    expect(filtrarCatalogo(datos, { q: "nuble" }).map((i) => i.Codigo)).toEqual(["16101", "16303"]);
    expect(filtrarCatalogo(datos, { q: "metropolitana" }).map((i) => i.Codigo)).toEqual(["13123", "13101"]);
  });
  it("funciona con elementos sin padre", () => {
    const sinPadre = [I("CONTADO", "Contado"), I("CREDITO_30", "Crédito 30 días", 0)];
    expect(filtrarCatalogo(sinPadre, { q: "credito" }).map((i) => i.Codigo)).toEqual(["CREDITO_30"]);
    expect(filtrarCatalogo(sinPadre, { q: "contado" }).map((i) => i.Codigo)).toEqual(["CONTADO"]);
  });
  it("filtra por estado y lo combina con el texto", () => {
    expect(filtrarCatalogo(datos, { estado: 0 }).map((i) => i.Codigo)).toEqual(["16303", "13123"]);
    expect(filtrarCatalogo(datos, { estado: 1 })).toHaveLength(3);
    expect(filtrarCatalogo(datos, { q: "nuble", estado: 1 }).map((i) => i.Codigo)).toEqual(["16101"]);
    expect(filtrarCatalogo(datos, { q: "valparaiso", estado: 0 })).toEqual([]);
  });
  it("texto vacío o con espacios no filtra; sin coincidencias devuelve vacío", () => {
    expect(filtrarCatalogo(datos, { q: "   " })).toHaveLength(5);
    expect(filtrarCatalogo(datos, { q: "zzz" })).toEqual([]);
  });
  it("no modifica la lista original", () => {
    const copia = [...datos];
    filtrarCatalogo(datos, { q: "a" });
    expect(datos).toEqual(copia);
  });
});
