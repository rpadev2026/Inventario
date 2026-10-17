import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Migración 0042: líneas vendidas de Fudo y reportes de ventas por producto y por período (fechas de Chile). */
const dir = join(__dirname, "..");
let db: PGlite;
const val = async (sql: string) => Object.values((await db.query<any>(sql)).rows[0])[0] as any;
const fails = (sql: string, msg: RegExp) => expect(db.query(sql)).rejects.toThrow(msg);
const vender = (id: string, cierre: string, lineas: object[]) =>
  db.query(`select procesar_venta_fudo('${id}', '${cierre}', '${JSON.stringify(lineas)}'::jsonb)`);
const L = (producto: string, nombre: string, cantidad: number, monto: number | null) => ({ producto, nombre, cantidad, monto });

type Prod = { total: number; ventas: number; unidades: number; monto: number; lineasSinMonto: number;
  filas: { idProductoFudo: string; producto: string; unidades: number; monto: number | null; ventas: number; sinMonto: number; receta: string | null }[] };
type Per = { ventas: number; unidades: number; monto: number; lineasSinMonto: number; filas: { periodo: string; ventas: number; unidades: number; monto: number }[] };
const prod = async (d: string, h: string, q = "", off = 0, lim = 50) =>
  (await val(`select reporte_ventas_producto('${d}', '${h}', '${q}', ${off}, ${lim})`)) as Prod;
const per = async (d: string, h: string, a: string) => (await val(`select reporte_ventas_periodo('${d}', '${h}', '${a}')`)) as Per;
const fila = (r: Per) => r.filas.map((f) => [f.periodo, f.ventas, f.unidades, Number(f.monto)]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
  // «Pizza» (id Fudo 10) tiene receta vinculada; «Café» (20) no: igual cuenta como venta.
  await db.exec(`insert into "Recetas"("Nombre","IdProductoFudo") values ('PIZZA NAPOLITANA','10')`);
  // Octubre de 2026: el 5 es lunes (la semana va del 5 al 11). Chile está en UTC-3 en octubre.
  await vender("V1", "2026-10-05T12:00:00-03:00", [L("10", "Pizza", 2, 18000), L("20", "Café", 1, 2500)]);
  await vender("V2", "2026-10-06T01:30:00Z", [L("10", "Pizza", 1, 9000)]); // 22:30 del 5 en Chile: cuenta el día 5
  await vender("V3", "2026-10-06T13:00:00-03:00", [L("20", "Café", 3, null)]); // Fudo no informó el precio
  await vender("V4", "2026-10-11T20:00:00-03:00", [L("10", "Pizza", 1, 9000)]);
  await vender("V5", "2026-10-12T12:00:00-03:00", [L("20", "Café", 1, 2500)]);
  await vender("V6", "2026-09-30T12:00:00-03:00", [L("10", "Pizza", 5, 45000)]);
});

describe("líneas vendidas", () => {
  it("se guardan todas, tengan o no receta vinculada, y no se duplican al reprocesar la misma venta", async () => {
    expect(Number(await val(`select count(*) from "VentasFudoLineas"`))).toBe(7);
    await vender("V1", "2026-10-05T12:00:00-03:00", [L("10", "Pizza", 2, 18000), L("20", "Café", 1, 2500)]);
    expect(Number(await val(`select count(*) from "VentasFudoLineas"`))).toBe(7);
  });
  it("una línea sin cantidad positiva no se guarda y un monto negativo se guarda como sin monto", async () => {
    await vender("V7", "2026-10-20T12:00:00-03:00", [L("30", "Cero", 0, 100), L("30", "Negativo", 1, -5)]);
    expect((await db.query<any>(`select "Nombre", "Monto" from "VentasFudoLineas" where "IdVentaFudo" = 'V7'`)).rows).toEqual([{ Nombre: "Negativo", Monto: null }]);
    await db.exec(`delete from "VentasFudoLineas" where "IdVentaFudo" = 'V7'; delete from "VentasFudo" where "IdVentaFudo" = 'V7'`);
  });
});

describe("reporte_ventas_producto", () => {
  it("resume por producto de Fudo: unidades, monto, ventas y la receta vinculada", async () => {
    const r = await prod("2026-10-05", "2026-10-11");
    expect(r.filas.map((f) => [f.producto, f.unidades, f.monto === null ? null : Number(f.monto), f.ventas, f.receta])).toEqual([
      ["Café", 4, 2500, 2, null],
      ["Pizza", 4, 36000, 3, "PIZZA NAPOLITANA"],
    ]);
    expect([r.total, r.ventas, r.unidades, Number(r.monto), r.lineasSinMonto]).toEqual([2, 4, 8, 38500, 1]);
    expect(r.filas.find((f) => f.producto === "Café")!.sinMonto).toBe(1);
  });
  // Regresión de zona horaria: V2 se cerró el 6 a las 01:30 UTC, que en Chile es el 5 a las 22:30.
  it("usa fechas de Chile, no de UTC", async () => {
    expect((await prod("2026-10-06", "2026-10-06")).filas.map((f) => [f.producto, f.unidades])).toEqual([["Café", 3]]);
    expect((await prod("2026-10-05", "2026-10-05")).ventas).toBe(2);
  });
  it("las fechas del rango son inclusivas", async () => {
    expect((await prod("2026-09-30", "2026-09-30")).ventas).toBe(1);
    expect((await prod("2026-09-30", "2026-10-12")).ventas).toBe(6);
  });
  it("un producto sin ningún precio informado tiene monto null (no 0)", async () => {
    const r = await prod("2026-10-06", "2026-10-06");
    expect(r.filas[0].monto).toBeNull();
    expect(Number(r.monto)).toBe(0);
  });
  it("busca por nombre sin distinguir tildes ni mayúsculas y pagina sin cambiar los totales", async () => {
    expect((await prod("2026-10-01", "2026-10-31", "CAFE")).filas.map((f) => f.producto)).toEqual(["Café"]);
    expect((await prod("2026-10-01", "2026-10-31", "pizz")).filas.map((f) => f.producto)).toEqual(["Pizza"]);
    const p1 = await prod("2026-10-01", "2026-10-31", "", 0, 1), p2 = await prod("2026-10-01", "2026-10-31", "", 1, 1);
    expect([p1.filas.length, p2.filas.length, p1.total, p2.total]).toEqual([1, 1, 2, 2]);
  });
  it("un rango sin ventas devuelve ceros y las fechas inválidas se rechazan", async () => {
    const r = await prod("2020-01-01", "2020-01-31");
    expect([r.total, r.ventas, r.unidades, Number(r.monto), r.filas.length]).toEqual([0, 0, 0, 0, 0]);
    await fails(`select reporte_ventas_producto('2026-10-10', '2026-10-01', '', 0, 10)`, /fecha inicial no puede ser posterior/);
    await fails(`select reporte_ventas_producto(null, '2026-10-01', '', 0, 10)`, /Indique el rango/);
  });
});

describe("reporte_ventas_periodo", () => {
  it("diario: una fila por día (con ceros) y la venta de las 22:30 cuenta el día 5", async () => {
    const r = await per("2026-10-05", "2026-10-07", "dia");
    expect(fila(r)).toEqual([["2026-10-05", 2, 4, 29500], ["2026-10-06", 1, 3, 0], ["2026-10-07", 0, 0, 0]]);
    expect([r.ventas, r.unidades, Number(r.monto), r.lineasSinMonto]).toEqual([3, 7, 29500, 1]);
  });
  it("semanal: de lunes a domingo; los extremos son parciales", async () => {
    expect(fila(await per("2026-10-05", "2026-10-18", "semana"))).toEqual([["2026-10-05", 4, 8, 38500], ["2026-10-12", 1, 1, 2500]]);
    // empieza un miércoles: la primera semana cuenta solo desde el 7 (el domingo 11 sí), aparece con su lunes
    expect(fila(await per("2026-10-07", "2026-10-13", "semana"))).toEqual([["2026-10-05", 1, 1, 9000], ["2026-10-12", 1, 1, 2500]]);
  });
  it("mensual: una fila por mes del rango", async () => {
    const r = await per("2026-09-15", "2026-10-31", "mes");
    expect(fila(r)).toEqual([["2026-09-01", 1, 5, 45000], ["2026-10-01", 5, 9, 41000]]);
  });
  it("un rango sin ventas devuelve los períodos en cero", async () => {
    const r = await per("2020-01-01", "2020-01-03", "dia");
    expect(fila(r)).toEqual([["2020-01-01", 0, 0, 0], ["2020-01-02", 0, 0, 0], ["2020-01-03", 0, 0, 0]]);
    expect(r.ventas).toBe(0);
  });
  it("valida el rango y la agrupación", async () => {
    await fails(`select reporte_ventas_periodo('2026-10-10', '2026-10-01', 'dia')`, /fecha inicial no puede ser posterior/);
    await fails(`select reporte_ventas_periodo('2026-10-01', '2026-10-31', 'año')`, /Agrupación no válida/);
    await fails(`select reporte_ventas_periodo('2015-01-01', '2026-10-31', 'dia')`, /5 años/);
    await fails(`select reporte_ventas_periodo(null, '2026-10-31', 'dia')`, /Indique el rango/);
  });
});
