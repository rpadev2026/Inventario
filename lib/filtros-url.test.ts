import { describe, it, expect } from "vitest";
import { leerGuardado, resolverFiltros } from "./filtros-url";

const guardar = (o: object) => JSON.stringify(o);

describe("resolverFiltros", () => {
  it("con filtros en la URL: los guarda y redirige a la ruta limpia", () => {
    const r = resolverFiltros("/productos", "q=sal&pagina=2", undefined);
    expect(r.redirigir).toBe(true);
    expect(r.limpia).toBe("");
    expect(JSON.parse(r.cookie!)).toEqual({ "/productos": { q: "sal", pagina: "2" } });
  });

  it("deja en la URL lo que no es filtro (vistas, avisos, _rsc)", () => {
    const r = resolverFiltros("/productos", "ver=abc&q=sal&aviso=ok&_rsc=1", undefined);
    expect(r.limpia).toBe("ver=abc&aviso=ok&_rsc=1");
  });

  it("sin filtros en la URL: agrega los guardados para la página y no toca la cookie", () => {
    const c = guardar({ "/productos": { q: "sal", pagina: "3" }, "/bodegas": { q: "x" } });
    const r = resolverFiltros("/productos", "ver=abc", c);
    expect(r.redirigir).toBe(false);
    expect(new URLSearchParams(r.efectiva).get("q")).toBe("sal");
    expect(new URLSearchParams(r.efectiva).get("pagina")).toBe("3");
    expect(new URLSearchParams(r.efectiva).get("ver")).toBe("abc");
    expect(r.cookie).toBeUndefined();
  });

  it("combina: lo nuevo pisa, lo ausente se conserva, lo vacío borra", () => {
    const c = guardar({ "/productos": { q: "sal", estado: "1", pagina: "3" } });
    const r = resolverFiltros("/productos", "pagina=4", c);
    expect(JSON.parse(r.cookie!)["/productos"]).toEqual({ q: "sal", estado: "1", pagina: "4" });
    const l = resolverFiltros("/productos", "q=&estado=&pagina=", c);
    expect(l.cookie).toBeNull();
  });

  it("cada ruta guarda lo suyo", () => {
    const c = guardar({ "/productos": { q: "sal" } });
    const r = resolverFiltros("/bodegas", "q=frio", c);
    expect(JSON.parse(r.cookie!)).toEqual({ "/productos": { q: "sal" }, "/bodegas": { q: "frio" } });
    expect(resolverFiltros("/recetas", "", c).efectiva).toBe("");
  });

  it("sin filtros guardados ni en la URL no cambia nada", () => {
    const r = resolverFiltros("/productos", "", undefined);
    expect(r).toEqual({ redirigir: false, limpia: "", efectiva: "", cookie: undefined });
  });
});

describe("leerGuardado", () => {
  it("ignora basura, claves desconocidas y rutas que no empiezan con /", () => {
    expect(leerGuardado("no es json")).toEqual({});
    expect(leerGuardado("[1]")).toEqual({});
    expect(leerGuardado(guardar({ x: { q: "a" }, "/p": { ver: "token", editar: "t", q: "a", tam: 5 } }))).toEqual({ "/p": { q: "a" } });
  });
  it("una cookie manipulada no puede inyectar vistas ni valores enormes", () => {
    const r = resolverFiltros("/p", "", guardar({ "/p": { ver: "otro", q: "x".repeat(500) } }));
    expect(r.efectiva).toBe("");
  });
});
