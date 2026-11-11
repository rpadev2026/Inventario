import { describe, it, expect } from "vitest";
import { procesarTrabajoCon, type ColaFudo } from "./cola-fudo";
import type { ResumenSincronizacion } from "./sincronizar-ventas";

const R: ResumenSincronizacion = { revisadas: 4, procesadas: 3, yaProcesadas: 1, lineasOmitidas: 0, errores: [] };

function armar(hay = true) {
  const llamadas: any[] = [];
  const cola: ColaFudo = {
    reclamar: async () => (hay ? { id: 7 } : null),
    avance: async (id, a) => { llamadas.push(["avance", id, a]); },
    terminar: async (id, r, e) => { llamadas.push(["terminar", id, r, e]); },
  };
  return { cola, llamadas };
}

describe("procesarTrabajoCon", () => {
  it("sin trabajo pendiente no corre nada", async () => {
    const { cola, llamadas } = armar(false);
    let corrio = false;
    expect(await procesarTrabajoCon(cola, async () => { corrio = true; return {}; })).toEqual({ ejecutado: false });
    expect(corrio).toBe(false);
    expect(llamadas).toEqual([]);
  });

  it("al terminar bien cierra el trabajo con el resumen", async () => {
    const { cola, llamadas } = armar();
    const r = await procesarTrabajoCon(cola, async () => ({ resumen: R }));
    expect(r).toEqual({ ejecutado: true, resumen: R });
    expect(llamadas).toEqual([["terminar", 7, { ...R, total: 4 }, null]]);
  });

  it("un error de la sincronización queda en el trabajo y no lanza", async () => {
    const { cola, llamadas } = armar();
    const r = await procesarTrabajoCon(cola, async () => ({ error: "Fudo caído" }));
    expect(r).toMatchObject({ ejecutado: true, error: "Fudo caído" });
    expect(llamadas).toEqual([["terminar", 7, null, "Fudo caído"]]);
    const b = armar();
    await procesarTrabajoCon(b.cola, async () => { throw new Error("boom"); });
    expect(b.llamadas).toEqual([["terminar", 7, null, "boom"]]);
  });

  it("avisa el avance como máximo cada cadaMs", async () => {
    const { cola, llamadas } = armar();
    let t = 0;
    await procesarTrabajoCon(cola, async (av) => {
      for (const ms of [1000, 2000, 5000, 6000, 11000]) { t = ms; await av(R, 10); }
      return { resumen: R };
    }, { ahora: () => t, cadaMs: 5000 });
    expect(llamadas.filter((l) => l[0] === "avance").map((l) => l[1])).toEqual([7, 7]); // a los 5 s y a los 11 s
  });

  it("un fallo al guardar el avance no frena la sincronización", async () => {
    const { cola } = armar();
    cola.avance = async () => { throw new Error("red"); };
    let t = 0;
    const r = await procesarTrabajoCon(cola, async (av) => { t = 9999; await av(R, 1); return { resumen: R }; }, { ahora: () => t, cadaMs: 5000 });
    expect(r.ejecutado).toBe(true);
    expect(r.resumen).toEqual(R);
  });

  it("si no se puede cerrar el trabajo igual devuelve el resultado (el latido vencido lo deja retomar)", async () => {
    const { cola } = armar();
    cola.terminar = async () => { throw new Error("red"); };
    expect(await procesarTrabajoCon(cola, async () => ({ resumen: R }))).toEqual({ ejecutado: true, resumen: R });
  });
});
