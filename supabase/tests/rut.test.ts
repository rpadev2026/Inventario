import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Migración 0037: el RUT se guarda sin ceros a la izquierda y las claves únicas lo ven como uno solo. */
const dir = join(__dirname, "..");
let db: PGlite;
const fails = (sql: string, msg?: RegExp) => expect(db.query(sql)).rejects.toThrow(msg);
const val = async (sql: string) => Object.values((await db.query<any>(sql)).rows[0])[0] as any;

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
  await db.exec(`insert into "Proveedores"("Rut","RazonSocial","Giro") values ('1234567-4','Prov A','x'),('7654321-6','Prov B','x');`);
});

describe("RUT sin ceros a la izquierda (0037)", () => {
  it("un proveedor con ceros se guarda en forma canónica", async () => {
    await db.query(`insert into "Proveedores"("Rut","RazonSocial","Giro") values ('0076086428-5','Prov C','x')`);
    expect(await val(`select "Rut" from "Proveedores" where "RazonSocial" = 'Prov C'`)).toBe('76086428-5');
  });
  it("el mismo RUT con ceros choca con el proveedor ya registrado (antes se aceptaba como otro)", async () => {
    await fails(`insert into "Proveedores"("Rut","RazonSocial","Giro") values ('01234567-4','Prov D','x')`, /unique|duplicate/i);
    await fails(`update "Proveedores" set "Rut" = '07654321-6' where "RazonSocial" = 'Prov A'`, /unique|duplicate/i);
  });
  it("un vendedor con ceros no puede quedar vigente en dos proveedores", async () => {
    const a = await val(`select "IdProveedor" from "Proveedores" where "RazonSocial" = 'Prov A'`);
    const b = await val(`select "IdProveedor" from "Proveedores" where "RazonSocial" = 'Prov B'`);
    await db.query(`insert into "ProveedoresVendedores"("IdProveedor","Rut","Nombres","Apellidos") values (${a},'1111111-1','V','Uno')`);
    await fails(`insert into "ProveedoresVendedores"("IdProveedor","Rut","Nombres","Apellidos") values (${b},'01111111-1','V','Dos')`, /unique|duplicate/i);
    expect(await val(`select "Rut" from "ProveedoresVendedores" where "Apellidos" = 'Uno'`)).toBe('1111111-1');
  });
  it("también el RUT del representante y el de los usuarios", async () => {
    await db.query(`update "Proveedores" set "RutRepresentanteLegal" = '009999999-5' where "RazonSocial" = 'Prov A'`);
    expect(await val(`select "RutRepresentanteLegal" from "Proveedores" where "RazonSocial" = 'Prov A'`)).toBe('9999999-5');
    await db.query(`insert into "Usuarios"("Rut","Nombres","Apellidos","Correo") values ('012345678-5','Ana','X','ana@x.cl')`);
    expect(await val(`select "Rut" from "Usuarios" where "Correo" = 'ana@x.cl'`)).toBe('12345678-5');
    await fails(`insert into "Usuarios"("Rut","Nombres","Apellidos","Correo") values ('12345678-5','Otra','Y','otra@x.cl')`, /unique|duplicate/i);
  });
  it("un RUT nulo del representante no falla", async () => {
    await db.query(`update "Proveedores" set "RutRepresentanteLegal" = null where "RazonSocial" = 'Prov B'`);
    expect(await val(`select "RutRepresentanteLegal" is null from "Proveedores" where "RazonSocial" = 'Prov B'`)).toBe(true);
  });
});
