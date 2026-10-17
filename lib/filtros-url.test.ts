import { describe, it, expect } from "vitest";
import { leerGuardado, resolverFiltros } from "./filtros-url";

const guardar = (o: object) => JSON.stringify(o);
const q = (s: string) => Object.fromEntries(new URLSearchParams(s));

describe("resolverFiltros", () => {
  it("con filtros en la URL: la página los ve y se guardan", () => {
    const r = resolverFiltros("/productos", "q=sal&pagina=2", undefined);
    expect(q(r.efectiva)).toEqual({ q: "sal", pagina: "2" });
    expect(JSON.parse(r.cookie!)).toEqual({ "/productos": { q: "sal", pagina: "2" } });
  });

  it("lo que no es filtro (vistas, avisos, _rsc) pasa tal cual y no se guarda", () => {
    const r = resolverFiltros("/productos", "ver=abc&q=sal&aviso=ok&_rsc=1", undefined);
    expect(q(r.efectiva)).toEqual({ ver: "abc", q: "sal", aviso: "ok", _rsc: "1" });
    expect(JSON.parse(r.cookie!)).toEqual({ "/productos": { q: "sal" } });
  });

  it("sin filtros en la URL: la página ve los guardados y la cookie no cambia", () => {
    const c = guardar({ "/productos": { q: "sal", pagina: "3" }, "/bodegas": { q: "x" } });
    const r = resolverFiltros("/productos", "ver=abc", c);
    expect(q(r.efectiva)).toEqual({ ver: "abc", q: "sal", pagina: "3" });
    expect(r.cookie).toBeUndefined();
  });

  it("combina: lo nuevo pisa, lo ausente se conserva, lo vacío borra", () => {
    const c = guardar({ "/productos": { q: "sal", estado: "1", pagina: "3" } });
    const r = resolverFiltros("/productos", "pagina=4", c);
    expect(q(r.efectiva)).toEqual({ q: "sal", estado: "1", pagina: "4" });
    expect(JSON.parse(r.cookie!)["/productos"]).toEqual({ q: "sal", estado: "1", pagina: "4" });
    const l = resolverFiltros("/productos", "q=&estado=&pagina=", c);
    expect(l.efectiva).toBe("");
    expect(l.cookie).toBeNull();
  });

  it("cada ruta guarda lo suyo", () => {
    const c = guardar({ "/productos": { q: "sal" } });
    const r = resolverFiltros("/bodegas", "q=frio", c);
    expect(JSON.parse(r.cookie!)).toEqual({ "/productos": { q: "sal" }, "/bodegas": { q: "frio" } });
    expect(resolverFiltros("/recetas", "", c).efectiva).toBe("");
  });

  it("sin filtros guardados ni en la URL no cambia nada", () => {
    expect(resolverFiltros("/productos", "", undefined)).toEqual({ efectiva: "", cookie: undefined });
  });
});

describe("leerGuardado", () => {
  it("ignora basura, claves desconocidas y rutas que no empiezan con /", () => {
    expect(leerGuardado("no es json")).toEqual({});
    expect(leerGuardado("[1]")).toEqual({});
    expect(leerGuardado(guardar({ x: { q: "a" }, "/p": { ver: "token", editar: "t", q: "a", tam: 5 } }))).toEqual({ "/p": { q: "a" } });
  });
  it("una cookie manipulada no puede inyectar vistas ni valores enormes", () => {
    expect(resolverFiltros("/p", "", guardar({ "/p": { ver: "otro", q: "x".repeat(500) } })).efectiva).toBe("");
  });
});
