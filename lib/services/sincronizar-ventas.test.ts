import { describe, it, expect } from "vitest";
import { sincronizarVentasCon, SOLAPE_MS, type RepoVentas } from "./sincronizar-ventas";
import type { VentaFudo } from "./fudo";

const v = (id: string): VentaFudo => ({ id, cierre: "2026-10-15T20:00:00Z", lineas: [] });
const DESDE = new Date("2026-10-01T00:00:00Z"), AHORA = new Date("2026-10-16T12:00:00Z");

function armar(ventas: VentaFudo[], repo: Partial<RepoVentas> = {}) {
  const pedidos: [Date, Date][] = [];
  const origen = { ventasCerradas: async (d: Date, h: Date) => { pedidos.push([d, h]); return ventas; } };
  const r: RepoVentas = { ultimoCierre: async () => null, procesar: async () => ({ procesada: true, omitidos: 0 }), ...repo };
  return { origen, r, pedidos };
}

describe("sincronizarVentasCon", () => {
  it("sin ventas previas lee desde la fecha de inicio configurada hasta ahora", async () => {
    const { origen, r, pedidos } = armar([]);
    await sincronizarVentasCon(origen, r, { desde: DESDE, ahora: AHORA });
    expect(pedidos).toEqual([[DESDE, AHORA]]);
  });
  it("con ventas previas retrocede el solape desde el último cierre, sin pasar de la fecha de inicio", async () => {
    const ultimo = new Date("2026-10-14T20:00:00Z");
    const a = armar([], { ultimoCierre: async () => ultimo });
    await sincronizarVentasCon(a.origen, a.r, { desde: DESDE, ahora: AHORA });
    expect(a.pedidos[0][0]).toEqual(new Date(ultimo.getTime() - SOLAPE_MS));
    const b = armar([], { ultimoCierre: async () => new Date("2026-10-02T00:00:00Z") });
    await sincronizarVentasCon(b.origen, b.r, { desde: DESDE, ahora: AHORA });
    expect(b.pedidos[0][0]).toEqual(DESDE);
  });
  it("cuenta procesadas, ya procesadas y líneas omitidas", async () => {
    const ya = new Set(["B"]);
    const { origen, r } = armar([v("A"), v("B"), v("C")], { procesar: async (x) => (ya.has(x.id) ? { procesada: false, omitidos: 0 } : { procesada: true, omitidos: x.id === "C" ? 2 : 0 }) });
    expect(await sincronizarVentasCon(origen, r, { desde: DESDE, ahora: AHORA })).toEqual({ revisadas: 3, procesadas: 2, yaProcesadas: 1, lineasOmitidas: 2, errores: [] });
  });
  it("una venta que falla no frena a las demás y se informa", async () => {
    const { origen, r } = armar([v("A"), v("B"), v("C")], { procesar: async (x) => { if (x.id === "B") throw new Error("boom"); return { procesada: true, omitidos: 0 }; } });
    const res = await sincronizarVentasCon(origen, r, { desde: DESDE, ahora: AHORA });
    expect(res.procesadas).toBe(2);
    expect(res.errores).toEqual(["Venta B: boom"]);
  });
});
