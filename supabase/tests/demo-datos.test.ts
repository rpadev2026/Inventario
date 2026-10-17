import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname, "..");
let db: PGlite;
const q = async (sql: string) => (await db.query<any>(sql)).rows;
const uno = async (sql: string) => Object.values((await q(sql))[0])[0] as any;

// Base como la real: esquema + semilla + usuarios 1 (admin) y 35 (JORGE), 3 proveedores, bodegas de cocina y productos P01/I01/S01 ya existentes.
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
  await db.exec(`
    insert into "Usuarios"("IdUsuario","Rut","Nombres","Apellidos","Correo") overriding system value values
      (1,'1-9','Administrador','A','admin@x.cl'),(35,'2-7','Jorge','B','usuario@x.cl');
    insert into "Proveedores"("IdProveedor","Rut","RazonSocial") overriding system value values
      (8,'11111111-1','H Y N'),(45,'22222222-2','Henry'),(55,'33333333-3','Frema');
    insert into "Bodegas"("NombreBodega") values ('CUARTO FRIO'),('CUARTO CALIENTE');
    insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values ('P01','PAPAS','G','BOLSA'),('I01','JAMON','G','BOLSA'),('S01','SAL','G','BOLSA');
    update "StockBodega" set "Cantidad" = 0;
    insert into "StockBodega"("IdBodega","IdProducto","Cantidad") select b."IdBodega", p."IdProducto", 10000 from "Bodegas" b, "Productos" p where b."EsCentral" and p."Codigo" = 'S01'
      on conflict ("IdBodega","IdProducto") do update set "Cantidad" = 10000;
  `);
  await db.exec(readFileSync(join(dir, "scripts", "demo-datos.sql"), "utf8"));
}, 120_000);

describe("demo-datos.sql", () => {
  it("carga productos, facturas, solicitudes, recetas y ventas", async () => {
    expect(Number(await uno(`select count(*) from "Productos" where "Codigo" in ('HAR01','BEB01')`))).toBe(2);
    expect(Number(await uno(`select count(*) from "Compras"`))).toBe(7);
    expect(Number(await uno(`select count(*) from "Solicitudes" where "EstadoSolicitud" = 3`))).toBe(2);
    expect(Number(await uno(`select count(*) from "Recetas" where "IdProductoFudo" like 'DEMO-%'`))).toBe(5);
    expect(Number(await uno(`select count(*) from "VentasFudo"`))).toBeGreaterThan(150);
  });

  it("ningún stock queda negativo", async () => {
    expect(Number(await uno(`select count(*) from "StockBodega" where "Cantidad" < 0`))).toBe(0);
  });

  it("los productos tienen costo y las ventas montos", async () => {
    expect(Number(await uno(`select count(*) from "Productos" where "Codigo" in ('HAR01','CAR01','P01','I01') and "CostoUnitarioBase" is null`))).toBe(0);
    expect(Number(await uno(`select count(*) from "VentasFudoLineas" where "Monto" is null`))).toBe(0);
  });

  it("se niega a correr dos veces", async () => {
    await expect(db.exec(readFileSync(join(dir, "scripts", "demo-datos.sql"), "utf8"))).rejects.toThrow(/ya están cargados/);
  });
});
