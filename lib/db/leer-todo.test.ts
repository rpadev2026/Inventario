import { describe, it, expect } from "vitest";
import { leerTodo } from "./leer-todo";

/** Simula la API: `tope` filas como máximo por petición, aunque se pidan más. */
const api = (total: number, tope: number, conCount = true) => {
  const todas = Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
  let llamadas = 0;
  return {
    llamadas: () => llamadas,
    armar: async (a: number, b: number) => {
      llamadas++;
      return { data: todas.slice(a, Math.min(b, a + tope - 1) + 1), error: null, count: conCount ? total : null };
    },
  };
};

describe("leerTodo", () => {
  it("trae más filas que el límite de la API, sin repetir ni saltar", async () => {
    const s = api(2500, 1000);
    const { data } = await leerTodo(s.armar);
    expect(data.map((x) => x.id)).toEqual(Array.from({ length: 2500 }, (_, i) => i + 1));
    expect(s.llamadas()).toBe(3);
  });
  it("con la API limitada por debajo del bloque pedido sigue hasta el total", async () => {
    const { data } = await leerTodo(api(250, 100).armar);
    expect(data).toHaveLength(250);
  });
  it("una sola petición si cabe; sin total termina con una petición vacía", async () => {
    const a = api(10, 1000); await leerTodo(a.armar); expect(a.llamadas()).toBe(1);
    const b = api(10, 1000, false); expect((await leerTodo(b.armar)).data).toHaveLength(10); expect(b.llamadas()).toBe(2);
  });
  it("lanza error si una lectura falla (no devuelve un catálogo incompleto)", async () => {
    await expect(leerTodo(async () => ({ data: null, error: { code: "x" } }))).rejects.toThrow();
  });
});
