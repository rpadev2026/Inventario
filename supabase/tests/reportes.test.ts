import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Migración 0041: reporte de stock actual por producto y bodega, valorizado. */
const dir = join(__dirname, "..");
let db: PGlite;
const val = async (sql: string) => Object.values((await db.query<any>(sql)).rows[0])[0] as any;
const rep = async (bodega: number | null = null, q = "", soloConStock = false, off = 0, lim = 50) =>
  (await val(`select reporte_stock(${bodega ?? "null"}, '${q}', ${soloConStock}, ${off}, ${lim})`)) as {
    total: number; valorTotal: number; sinCosto: number;
    porBodega: { idBodega: number; bodega: string; filas: number; valor: number }[];
    filas: { bodega: string; codigo: string | null; producto: string; unidad: string; cantidad: number; costo: number | null; valor: number | null }[];
  };
let cocina = 0, bar = 0;

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
  await db.exec(`
    insert into "Bodegas"("NombreBodega") values ('Cocina'), ('Bar');
    insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values
      ('HAR','Harina','G','BOLSA'),('AJI','Ají en polvo','G','BOLSA'),('SAL','Sal','G','BOLSA'),('AGU','Agua','ML','BOTELLA');
    update "Productos" set "CostoUnitarioBase" = 0.002 where "Codigo" = 'HAR';
    update "Productos" set "CostoUnitarioBase" = 0.5 where "Codigo" = 'AJI';
    update "Productos" set "CostoUnitarioBase" = 0.025 where "Codigo" = 'AGU';
  `);
  cocina = Number(await val(`select "IdBodega" from "Bodegas" where "NombreBodega" = 'COCINA' or "NombreBodega" = 'Cocina'`));
  bar = Number(await val(`select "IdBodega" from "Bodegas" where "NombreBodega" = 'BAR' or "NombreBodega" = 'Bar'`));
  const p = (c: string) => `(select "IdProducto" from "Productos" where "Codigo" = '${c}')`;
  await db.exec(`
    insert into "StockBodega"("IdBodega","IdProducto","Cantidad") values
      (${cocina}, ${p("HAR")}, 10000), (${bar}, ${p("HAR")}, 2500.5),   -- el mismo producto en dos bodegas
      (${cocina}, ${p("AJI")}, 300), (${cocina}, ${p("SAL")}, 800),      -- SAL no tiene costo
      (${bar}, ${p("AGU")}, 0);                                          -- stock cero
  `);
});

describe("reporte_stock", () => {
  it("lista cada producto por bodega (el mismo producto en dos bodegas son dos filas) con su valor", async () => {
    const r = await rep();
    expect(r.total).toBe(5);
    const har = r.filas.filter((f) => f.codigo === "HAR");
    expect(har.map((f) => [f.bodega.toUpperCase(), f.cantidad, f.valor])).toEqual([["BAR", 2500.5, 5.0], ["COCINA", 10000, 20]]);
    expect(har[0].unidad).toBeTruthy();
  });
  it("el valor es cantidad × costo unitario base redondeado a 2 decimales y el total lo suma", async () => {
    const r = await rep();
    // HAR 10000×0,002=20 + 2500,5×0,002=5,001→5 + AJI 300×0,5=150 + AGU 0 = 175; SAL no suma
    expect(Number(r.valorTotal)).toBe(175);
    expect(r.filas.find((f) => f.codigo === "AJI")?.valor).toBe(150);
  });
  it("un producto sin costo no tiene valor (null), no suma y se cuenta aparte", async () => {
    const r = await rep();
    const sal = r.filas.find((f) => f.codigo === "SAL")!;
    expect([sal.costo, sal.valor, sal.cantidad]).toEqual([null, null, 800]);
    expect(r.sinCosto).toBe(1);
    expect((await rep(null, "agua")).sinCosto).toBe(0); // el contador respeta los filtros
  });
  it("filtra por bodega, y los subtotales por bodega suman el total", async () => {
    const r = await rep(cocina);
    expect(r.filas.every((f) => f.bodega.toUpperCase() === "COCINA")).toBe(true);
    expect(r.total).toBe(3);
    const todas = await rep();
    expect(todas.porBodega.map((b) => [b.bodega.toUpperCase(), b.filas, Number(b.valor)])).toEqual([["BAR", 2, 5], ["COCINA", 3, 170]]);
    expect(todas.porBodega.reduce((a, b) => a + Number(b.valor), 0)).toBe(Number(todas.valorTotal));
  });
  it("busca por código o nombre sin distinguir tildes ni mayúsculas", async () => {
    expect((await rep(null, "aji")).filas.map((f) => f.codigo)).toEqual(["AJI"]);
    expect((await rep(null, "AJÍ")).filas.map((f) => f.codigo)).toEqual(["AJI"]);
    expect((await rep(null, "har")).filas.length).toBe(2);
    expect((await rep(null, "no existe")).total).toBe(0);
  });
  it("«solo con stock» oculta las filas en cero", async () => {
    expect((await rep(null, "", false)).total).toBe(5);
    const r = await rep(null, "", true);
    expect(r.total).toBe(4);
    expect(r.filas.some((f) => f.codigo === "AGU")).toBe(false);
  });
  it("pagina las filas pero los totales son los de todo el resultado", async () => {
    const p1 = await rep(null, "", false, 0, 2), p2 = await rep(null, "", false, 2, 2);
    expect(p1.filas.length).toBe(2);
    expect(p2.filas.length).toBe(2);
    expect([p1.total, p2.total]).toEqual([5, 5]);
    expect(Number(p1.valorTotal)).toBe(175);
    expect([...p1.filas, ...p2.filas].map((f) => f.codigo + f.bodega)).toEqual(
      (await rep(null, "", false, 0, 4)).filas.map((f) => f.codigo + f.bodega));
  });
  it("el stock negativo (ventas de Fudo) se valoriza en negativo", async () => {
    await db.exec(`select set_config('inventario.permitir_stock_negativo', 'on', false)`);
    await db.exec(`insert into "StockBodega"("IdBodega","IdProducto","Cantidad") values (${bar}, (select "IdProducto" from "Productos" where "Codigo" = 'AJI'), -100)`);
    await db.exec(`select set_config('inventario.permitir_stock_negativo', '', false)`);
    const f = (await rep(bar, "aji")).filas[0];
    expect([f.cantidad, f.valor]).toEqual([-100, -50]);
  });
  it("límites: página y tamaño fuera de rango no fallan", async () => {
    expect((await rep(null, "", false, -5, 0)).filas.length).toBe(1);
    expect((await rep(null, "", false, 999, 10)).filas.length).toBe(0);
  });
});

describe("permiso reportes.ver", () => {
  it("existe en el catálogo y el rol Compras lo recibe; Solicitante y Bodeguero no", async () => {
    expect(await val(`select "Modulo" from "Permisos" where "Codigo" = 'reportes.ver'`)).toBe("Reportes");
    const rol = async (n: string) => Number(await val(`select count(*) from "RolesPermisos" rp join "Roles" r using("IdRol") where r."NombreRol" = '${n}' and rp."Permiso" = 'reportes.ver'`));
    expect([await rol("Compras"), await rol("Solicitante"), await rol("Bodeguero Central")]).toEqual([1, 0, 0]);
  });
});
