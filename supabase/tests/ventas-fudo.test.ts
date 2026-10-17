import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Ventas de Fudo que descuentan stock (migración 0034): consumo de ingredientes por receta, sub-recetas, idempotencia y stock negativo. */
const dir = join(__dirname, "..");
let db: PGlite;

async function fails(sql: string, msg?: RegExp) {
  await expect(db.query(sql)).rejects.toThrow(msg);
}
const val = async (sql: string) => Object.values((await db.query<any>(sql)).rows[0])[0] as any;
const stock = async (bodega: number, producto: string) =>
  Number(await val(`select coalesce((select "Cantidad" from "StockBodega" where "IdBodega" = ${bodega} and "IdProducto" = (select "IdProducto" from "Productos" where "Codigo" = '${producto}')), 0)`));
const vender = (id: string, lineas: object[]) =>
  db.query<any>(`select procesar_venta_fudo('${id}', '2026-10-15T20:00:00Z', '${JSON.stringify(lineas)}'::jsonb) r`).then((r) => r.rows[0].r as { procesada: boolean; omitidos: any[] });

let frio = 0, caliente = 0;

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
  await db.exec(`
    insert into "Usuarios"("Rut","Nombres","Apellidos","Correo") values ('1-9','Ana','Admin','ana@x.cl');
    insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values ('HAR','Harina','G','BOLSA'),('ACE','Aceite','ML','BOTELLA');
    insert into "Bodegas"("NombreBodega") values ('Cuarto frio'),('Cuarto caliente');
  `);
  frio = Number(await val(`select "IdBodega" from "Bodegas" where "NombreBodega" = 'Cuarto frio'`));
  caliente = Number(await val(`select "IdBodega" from "Bodegas" where "NombreBodega" = 'Cuarto caliente'`));
  await db.exec(`
    insert into "StockBodega"("IdBodega","IdProducto","Cantidad") select ${frio}, "IdProducto", 1000 from "Productos";
    -- Pizza: 2 porciones; harina 100 g con 25 % de merma (125 g brutos) por receta completa.
    insert into "Recetas"("Nombre","RendimientoPorciones") values ('Pizza', 2);
    insert into "RecetaDetalles"("IdReceta","IdProducto","Cantidad","PorcionNeta","UnidadMedida","PorcentajeMerma")
      select "IdReceta", (select "IdProducto" from "Productos" where "Codigo" = 'HAR'), 1, 100, 'G', 0.25 from "Recetas" where "Nombre" = 'PIZZA';
    -- Masa (sub-receta): rinde 1 kg con 600 g de harina y 400 ml de aceite.
    insert into "Recetas"("Nombre","RendimientoCantidad","RendimientoUnidad") values ('Masa', 1, 'KG');
    insert into "RecetaDetalles"("IdReceta","IdProducto","Cantidad","PorcionNeta","UnidadMedida")
      select r."IdReceta", p."IdProducto", 1, case p."Codigo" when 'HAR' then 600 else 400 end, case p."Codigo" when 'HAR' then 'G' else 'ML' end
        from "Recetas" r, "Productos" p where r."Nombre" = 'MASA';
    -- Calzone: 1 porción con 200 g de Masa.
    insert into "Recetas"("Nombre") values ('Calzone');
    insert into "RecetaDetalles"("IdReceta","IdSubReceta","Cantidad","PorcionNeta","UnidadMedida")
      select c."IdReceta", m."IdReceta", 1, 200, 'G' from "Recetas" c, "Recetas" m where c."Nombre" = 'CALZONE' and m."Nombre" = 'MASA';
  `);
  const vincular = (nombre: string, fudo: string, bodega: number) =>
    db.query(`select vincular_receta_fudo(1, (select "IdReceta" from "Recetas" where "Nombre" = '${nombre}'), '${fudo}', ${bodega})`);
  await vincular("PIZZA", "10", frio);
  await vincular("CALZONE", "20", caliente);
});

describe("vincular_receta_fudo con bodega", () => {
  it("exige una bodega vigente para vincular y desvincular la limpia", async () => {
    const id = Number(await val(`insert into "Recetas"("Nombre") values ('Suelta') returning "IdReceta"`));
    await fails(`select vincular_receta_fudo(1, ${id}, '99', null)`, /Elija la bodega/);
    await fails(`select vincular_receta_fudo(1, ${id}, '99', 999999)`, /Elija la bodega/);
    await db.query(`select vincular_receta_fudo(1, ${id}, '99', ${frio})`);
    expect(Number(await val(`select "IdBodegaConsumo" from "Recetas" where "IdReceta" = ${id}`))).toBe(frio);
    await db.query(`select vincular_receta_fudo(1, ${id}, '', null)`);
    expect(await val(`select "IdBodegaConsumo" from "Recetas" where "IdReceta" = ${id}`)).toBeNull();
  });
  it("un producto de Fudo no se vincula a dos recetas", async () => {
    const id = Number(await val(`insert into "Recetas"("Nombre") values ('Otra') returning "IdReceta"`));
    await fails(`select vincular_receta_fudo(1, ${id}, '10', ${frio})`, /ya está vinculado/);
  });
  it("rechaza una receta que no existe", async () => {
    await fails(`select vincular_receta_fudo(1, 999999, '1', ${frio})`, /no existe/);
  });
});

describe("procesar_venta_fudo", () => {
  it("descuenta de la bodega de la receta, con merma y por porciones (4 vendidas de una receta de 2 porciones)", async () => {
    const r = await vender("V1", [{ producto: "10", nombre: "Pizza", cantidad: 4 }]);
    expect(r).toEqual({ procesada: true, omitidos: [] });
    expect(await stock(frio, "HAR")).toBe(1000 - 250); // 125 g × (4 / 2)
    expect(await stock(frio, "ACE")).toBe(1000);
  });
  it("expande las sub-recetas con la proporción de su rendimiento y usa la bodega de cada receta", async () => {
    await vender("V2", [{ producto: "20", nombre: "Calzone", cantidad: 1 }]); // 200 g de 1 kg de masa = 20 %
    expect(await stock(caliente, "HAR")).toBe(-120); // 600 g × 0,2, sin stock previo: queda negativo
    expect(await stock(caliente, "ACE")).toBe(-80);
  });
  it("es idempotente: la misma venta no descuenta dos veces", async () => {
    const antes = await stock(frio, "HAR");
    expect(await vender("V1", [{ producto: "10", nombre: "Pizza", cantidad: 4 }])).toEqual({ procesada: false, omitidos: [] });
    expect(await stock(frio, "HAR")).toBe(antes);
    expect(Number(await val(`select count(*) from "VentasFudo" where "IdVentaFudo" = 'V1'`))).toBe(1);
  });
  it("las líneas sin receta o sin bodega no descuentan y quedan registradas", async () => {
    const id = Number(await val(`insert into "Recetas"("Nombre") values ('Sin bodega') returning "IdReceta"`));
    await db.query(`update "Recetas" set "IdProductoFudo" = '30' where "IdReceta" = ${id}`); // vínculo sin bodega (solo posible por SQL directo)
    const antes = await stock(frio, "HAR");
    const r = await vender("V3", [{ producto: "999", nombre: "Agua", cantidad: 3 }, { producto: "30", nombre: "Sin bodega", cantidad: 1 }]);
    expect(r.procesada).toBe(true);
    expect(r.omitidos.map((o) => [o.producto, o.motivo])).toEqual([["999", "sin receta"], ["30", "sin bodega"]]);
    expect(await stock(frio, "HAR")).toBe(antes);
    expect((await db.query<any>(`select "Omitidos" o from "VentasFudo" where "IdVentaFudo" = 'V3'`)).rows[0].o).toHaveLength(2);
  });
  it("guarda qué se descontó por venta (auditoría)", async () => {
    const r = (await db.query<any>(`select "IdBodega","Cantidad" from "ConsumosVenta" where "IdVentaFudo" = 'V1'`)).rows;
    expect(r.map((x) => [x.IdBodega, Number(x.Cantidad)])).toEqual([[frio, 250]]);
  });
  it("una venta con varias líneas de la misma receta suma el consumo", async () => {
    const antes = await stock(frio, "HAR");
    await vender("V4", [{ producto: "10", nombre: "Pizza", cantidad: 1 }, { producto: "10", nombre: "Pizza", cantidad: 1 }]);
    expect(await stock(frio, "HAR")).toBe(antes - 125);
  });
  it("rechaza una venta sin identificador", async () => {
    await fails(`select procesar_venta_fudo('', now(), '[]'::jsonb)`, /Venta inválida/);
  });
});

describe("el stock sigue sin poder quedar negativo fuera de las ventas", () => {
  it("un descuento directo bajo cero falla con check_violation", async () => {
    await fails(`update "StockBodega" set "Cantidad" = -1 where "IdBodega" = ${frio}`, /Stock insuficiente/);
    await fails(`insert into "StockBodega"("IdBodega","IdProducto","Cantidad") select ${frio}, 99999, -1`, /./);
  });
  it("el permiso de negativo no se queda abierto tras una venta", async () => {
    await fails(`update "StockBodega" set "Cantidad" = -5 where "IdBodega" = ${frio} and "IdProducto" = (select "IdProducto" from "Productos" where "Codigo" = 'ACE')`, /Stock insuficiente/);
  });
});

/** Regresión (auditoría de seguridad): una fila que una venta dejó negativa debe poder recibir stock aunque siga negativa. */
describe("sumar stock a una fila que una venta dejó negativa (0035)", () => {
  const har = `(select "IdProducto" from "Productos" where "Codigo" = 'HAR')`;
  it("una suma parcial que sigue bajo cero se acepta (como recepcionar_solicitud / registrar_factura)", async () => {
    expect(await stock(caliente, "HAR")).toBe(-120); // lo dejó V2
    await db.query(`insert into "StockBodega"("IdBodega","IdProducto","Cantidad") values (${caliente}, ${har}, 50)
      on conflict ("IdBodega","IdProducto") do update set "Cantidad" = "StockBodega"."Cantidad" + excluded."Cantidad"`);
    expect(await stock(caliente, "HAR")).toBe(-70);
  });
  it("restarle a una fila negativa sigue rechazándose", async () => {
    await fails(`update "StockBodega" set "Cantidad" = "Cantidad" - 10 where "IdBodega" = ${caliente} and "IdProducto" = ${har}`, /Stock insuficiente/);
    expect(await stock(caliente, "HAR")).toBe(-70);
  });
  it("una fila nueva negativa sigue rechazándose y una suma que la deja positiva se acepta", async () => {
    await fails(`insert into "StockBodega"("IdBodega","IdProducto","Cantidad") select ${caliente}, 99998, -1`, /./);
    await db.query(`update "StockBodega" set "Cantidad" = "Cantidad" + 100 where "IdBodega" = ${caliente} and "IdProducto" = ${har}`);
    expect(await stock(caliente, "HAR")).toBe(30);
  });
});
