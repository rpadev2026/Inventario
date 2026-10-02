import { describe, it, expect, vi, beforeEach } from "vitest";

const llamadas: { op: string; fila: Record<string, unknown>; eq?: [string, unknown] }[] = [];
let errorSimulado: { code: string } | null = null;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../db/supabase", () => ({
  db: {
    from: () => ({
      insert: async (fila: Record<string, unknown>) => { llamadas.push({ op: "insert", fila }); return { error: errorSimulado }; },
      update: (fila: Record<string, unknown>) => ({
        eq: async (c: string, v: unknown) => { llamadas.push({ op: "update", fila, eq: [c, v] }); return { error: errorSimulado }; },
      }),
    }),
  },
}));

import { CATALOGOS, guardarCatalogo, prepararFila } from "./catalogo";
import { catalogoSchema } from "../validation/catalogo";

const cfg = CATALOGOS.formasPago;
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

beforeEach(() => { llamadas.length = 0; errorSimulado = null; });

describe("prepararFila", () => {
  it("normaliza el código a mayúsculas al crear", () => {
    const d = catalogoSchema.parse({ codigo: " contado ", nombre: "Contado", estado: "1" });
    const f = prepararFila(cfg, d, 7, false);
    expect(f).toMatchObject({ Codigo: "CONTADO", Nombre: "Contado", IdEstado: 1, IdUsuarioCreacion: 7, IdUsuarioModificacion: 7 });
  });
  it("al editar no incluye Codigo", () => {
    const d = catalogoSchema.parse({ codigo: "otro", nombre: "X", estado: "0" });
    const f = prepararFila(cfg, d, 7, true);
    expect(f).not.toHaveProperty("Codigo");
    expect(f).toEqual({ Nombre: "X", IdEstado: 0, IdUsuarioModificacion: 7 });
  });
});

describe("guardarCatalogo", () => {
  it("guarda CONTADO al escribir contado", async () => {
    const r = await guardarCatalogo(cfg, 1, fd({ codigo: "contado", nombre: "Contado", estado: "1" }));
    expect(r).toEqual({ ok: true });
    expect(llamadas[0].op).toBe("insert");
    expect(llamadas[0].fila.Codigo).toBe("CONTADO");
  });
  it("editar con otro código no lo cambia", async () => {
    const r = await guardarCatalogo(cfg, 1, fd({ modo: "editar", codigo: "contado", nombre: "Nuevo", estado: "0" }));
    expect(r.ok).toBe(true);
    expect(llamadas[0].op).toBe("update");
    expect(llamadas[0].fila).not.toHaveProperty("Codigo");
    expect(llamadas[0].eq).toEqual(["Codigo", "CONTADO"]);
  });
  it("duplicado devuelve mensaje de negocio", async () => {
    errorSimulado = { code: "23505" };
    const r = await guardarCatalogo(cfg, 1, fd({ codigo: "efectivo", nombre: "Efectivo" }));
    expect(r).toEqual({ error: "Ya existe un registro con ese código" });
  });
  it("otro error no filtra detalles", async () => {
    errorSimulado = { code: "XX000" };
    const r = await guardarCatalogo(cfg, 1, fd({ codigo: "A", nombre: "A" }));
    expect(r).toEqual({ error: "No se pudo guardar" });
  });
  it("código inválido se rechaza sin tocar la BD", async () => {
    const r = await guardarCatalogo(cfg, 1, fd({ codigo: "a b", nombre: "A" }));
    expect(r.error).toBeTruthy();
    expect(llamadas).toHaveLength(0);
  });
});
