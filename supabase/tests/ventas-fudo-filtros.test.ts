import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Migración 0044: filtros (fecha de Chile, producto, motivo), detalle de cada venta y exportación de las ventas de Fudo. */
const dir = join(__dirname, "..");
let db: PGlite;
const val = async (sql: string) => Object.values((await db.query<any>(sql)).rows[0])[0] as any;
const listar = (d = "null", h = "null", q = "''", m = "''", off = 0, lim = 10) => val(`select listar_ventas_fudo(${d}, ${h}, ${q}, ${m}, ${off}, ${lim})`);
const faltantes = (d = "null", h = "null", q = "''", m = "''", off = 0, lim = 10) => val(`select faltantes_ventas_fudo(${d}, ${h}, ${q}, ${m}, ${off}, ${lim})`);
const exportar = (d = "null", h = "null", q = "''", m = "''") => val(`select exportar_ventas_fudo(${d}, ${h}, ${q}, ${m})`);
const vender = (id: string, cierre: string, lineas: object[]) => db.query(`select procesar_venta_fudo('${id}', '${cierre}', '${JSON.stringify(lineas)}'::jsonb)`);

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
  await db.exec(`
    insert into "Usuarios"("Rut","Nombres","Apellidos","Correo") values ('1-9','Ana','Admin','ana@x.cl');
    insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values ('HAR','Harina','G','BOLSA');
    insert into "Bodegas"("NombreBodega") values ('Cocina');
    insert into "Recetas"("Nombre","RendimientoPorciones","IdProductoFudo","IdBodegaConsumo") values ('Pizza', 1, '10', (select "IdBodega" from "Bodegas" where "NombreBodega" ilike 'cocina'));
    insert into "RecetaDetalles"("IdReceta","IdProducto","Cantidad","PorcionNeta","UnidadMedida","PorcentajeMerma")
      select "IdReceta", (select "IdProducto" from "Productos" limit 1), 1, 100, 'G', 0 from "Recetas";
  `);
  // V1 (1-oct, Chile): pizza (con receta) + una Coca sin receta. V2 (2-oct): solo Coca. V3 (22:30 del 2-oct en Chile = 01:30 UTC del 3-oct): Pizza.
  await vender("V1", "2026-10-01T15:00:00Z", [{ producto: "10", nombre: "Pizza", cantidad: 2, monto: 20000 }, { producto: "20", nombre: "Coca Cola", cantidad: 1, monto: 2000 }]);
  await vender("V2", "2026-10-02T15:00:00Z", [{ producto: "20", nombre: "Coca Cola", cantidad: 3, monto: null }]);
  await vender("V3", "2026-10-03T01:30:00Z", [{ producto: "10", nombre: "Pizza", cantidad: 1, monto: 10000 }]);
  await db.exec(`update "Recetas" set "IdBodegaConsumo" = null`); // para probar el motivo «sin bodega» en una venta nueva
  await vender("V4", "2026-10-04T15:00:00Z", [{ producto: "10", nombre: "Pizza", cantidad: 1, monto: 10000 }]);
});

describe("0044: listar_ventas_fudo", () => {
  it("sin filtros trae todas, de la más reciente a la más antigua, con total", async () => {
    const r = await listar();
    expect(r.total).toBe(4);
    expect(r.filas.map((f: any) => f.id)).toEqual(["V4", "V3", "V2", "V1"]);
  });
  it("detalle: líneas con receta y estado, unidades y monto de la venta", async () => {
    const v1 = (await listar()).filas.find((f: any) => f.id === "V1");
    expect(v1.unidades).toBe(3);
    expect(v1.monto).toBe(22000);
    expect(v1.lineas).toEqual([
      { producto: "10", nombre: "Pizza", cantidad: 2, monto: 20000, receta: "PIZZA", estado: "descontó" },
      { producto: "20", nombre: "Coca Cola", cantidad: 1, monto: 2000, receta: null, estado: "sin receta" },
    ]);
  });
  it("detalle: ingredientes descontados por producto y bodega, y monto null si ninguna línea lo trae", async () => {
    const f = (await listar()).filas;
    expect(f.find((x: any) => x.id === "V1").consumos).toEqual([{ producto: "HAR — HARINA", bodega: "Cocina", cantidad: 200, unidad: "G" }]);
    expect(f.find((x: any) => x.id === "V2").monto).toBeNull();
    expect(f.find((x: any) => x.id === "V2").consumos).toEqual([]);
    expect(f.find((x: any) => x.id === "V4").lineas[0].estado).toBe("sin bodega");
  });
  it("filtra por fecha de Chile (no la de UTC): V3 cerró el 3-oct a las 01:30 UTC pero fue el 2-oct de noche en Chile", async () => {
    expect((await listar("'2026-10-03'", "'2026-10-03'")).total).toBe(0);
    expect((await listar("'2026-10-02'", "'2026-10-02'")).filas.map((f: any) => f.id).sort()).toEqual(["V2", "V3"]);
    expect((await listar("'2026-10-03'")).total).toBe(1);
    expect((await listar("null", "'2026-10-01'")).filas.map((f: any) => f.id)).toEqual(["V1"]);
  });
  it("filtra por producto (sin tildes ni mayúsculas) y por motivo", async () => {
    expect((await listar("null", "null", "'coca'")).filas.map((f: any) => f.id)).toEqual(["V2", "V1"]);
    expect((await listar("null", "null", "'PIZZ'")).total).toBe(3);
    expect((await listar("null", "null", "''", "'sin bodega'")).filas.map((f: any) => f.id)).toEqual(["V4"]);
    expect((await listar("null", "null", "''", "'sin receta'")).total).toBe(2);
    expect((await listar("null", "null", "'pizza'", "'sin receta'")).total).toBe(1); // V1 tiene pizza y una línea sin receta
  });
  it("pagina", async () => {
    const r = await listar("null", "null", "''", "''", 1, 2);
    expect(r.total).toBe(4);
    expect(r.filas.map((f: any) => f.id)).toEqual(["V3", "V2"]);
  });
});

describe("0044: faltantes_ventas_fudo con filtros", () => {
  it("suma lo omitido por producto de Fudo", async () => {
    const r = await faltantes();
    expect(r.total).toBe(2);
    expect(r.filas).toEqual([
      { producto: "20", nombre: "Coca Cola", motivo: "sin receta", cantidad: 4 },
      { producto: "10", nombre: "Pizza", motivo: "sin bodega", cantidad: 1 },
    ]);
  });
  it("filtra por fecha, producto y motivo, y pagina", async () => {
    expect((await faltantes("'2026-10-02'", "null")).filas.map((f: any) => f.cantidad)).toEqual([3, 1]);
    expect((await faltantes("null", "null", "'coca'")).total).toBe(1);
    expect((await faltantes("null", "null", "''", "'sin bodega'")).filas.map((f: any) => f.producto)).toEqual(["10"]);
    expect((await faltantes("null", "null", "''", "''", 1, 1)).filas.map((f: any) => f.producto)).toEqual(["10"]);
  });
});

describe("0044: exportar_ventas_fudo", () => {
  it("una fila por línea con receta y estado", async () => {
    const r = await exportar();
    expect(r.truncado).toBe(false);
    expect(r.filas).toHaveLength(5);
    expect(r.filas[r.filas.length - 1]).toMatchObject({ venta: "V1", nombre: "Coca Cola", estado: "sin receta", receta: null });
  });
  it("con texto de producto trae solo las líneas de ese producto de las ventas filtradas", async () => {
    const r = await exportar("null", "null", "'pizza'");
    expect(r.filas.map((f: any) => [f.venta, f.nombre])).toEqual([["V4", "Pizza"], ["V3", "Pizza"], ["V1", "Pizza"]]);
    expect((await exportar("'2026-10-02'", "'2026-10-02'", "''", "'sin receta'")).filas.map((f: any) => f.venta)).toEqual(["V2"]);
  });
});

describe("0045: resumen_ventas_fudo", () => {
  const resumen = (d = "null", h = "null", q = "''", m = "''") => val(`select resumen_ventas_fudo(${d}, ${h}, ${q}, ${m})`);
  it("sin filtros suma todas las ventas", async () => {
    expect(await resumen()).toEqual({ ventas: 4, unidades: 8, monto: 42000, productos: 2, lineasSinMonto: 1 });
  });
  it("coincide con las tablas: el filtro de motivo limita el resumen a esas ventas", async () => {
    expect(await resumen("null", "null", "''", "'sin bodega'")).toEqual({ ventas: 1, unidades: 1, monto: 10000, productos: 1, lineasSinMonto: 0 });
    expect((await listar("null", "null", "''", "'sin bodega'")).total).toBe(1);
  });
  it("con producto solo cuentan las líneas de ese producto", async () => {
    expect(await resumen("null", "null", "'coca'")).toEqual({ ventas: 2, unidades: 4, monto: 2000, productos: 1, lineasSinMonto: 1 });
  });
  it("si no hay ventas todo sale en 0", async () => {
    const cero = { ventas: 0, unidades: 0, monto: 0, productos: 0, lineasSinMonto: 0 };
    expect(await resumen("'2030-01-01'", "'2030-01-31'")).toEqual(cero);
    expect(await resumen("null", "null", "'inexistente'")).toEqual(cero);
    expect(await resumen("null", "null", "''", "'sin receta'", )).toMatchObject({ ventas: 2 });
  });
});
