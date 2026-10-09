import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname, "..");
const migs = readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort();
const ULTIMA = "0022_textos_mayuscula.sql";

async function conMigraciones(hasta: string[]) {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  for (const m of hasta) await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  return db;
}

describe("0022: textos existentes en mayúscula", () => {
  it("convierte nombres, direcciones y motivos; deja correos, RUT, códigos y roles", async () => {
    const db = await conMigraciones(migs.filter((m) => m < ULTIMA));
    await db.exec(`
      insert into "Usuarios"("Rut","Nombres","Apellidos","Correo") values ('1-9','Ana María','Pérez','Ana@x.cl');
      insert into "Proveedores"("Rut","RazonSocial","Giro","Direccion","NombreRepresentanteLegal") values ('76086428-5','Prov sa','alimentos','calle 1','juan pérez');
      insert into "ProveedoresSucursales"("IdProveedor","Direccion","EncargadoSucursal") select "IdProveedor",'av. sur','luis' from "Proveedores";
      insert into "ProveedoresVendedores"("IdProveedor","Rut","Nombres","Apellidos") select "IdProveedor",'2-7','pedro','soto' from "Proveedores";
      insert into "Bodegas"("NombreBodega") values ('cocina');
      update "FormasPago" set "Nombre" = 'contado' where "Codigo" = 'CONTADO';
    `);
    await db.exec(readFileSync(join(dir, "migrations", ULTIMA), "utf8"));
    const q = async (sql: string) => (await db.query<any>(sql)).rows[0];
    expect(await q(`select "Nombres","Apellidos","Correo" from "Usuarios"`)).toEqual({ Nombres: "ANA MARÍA", Apellidos: "PÉREZ", Correo: "Ana@x.cl" });
    expect(await q(`select "RazonSocial","Giro","Direccion","NombreRepresentanteLegal" from "Proveedores"`))
      .toEqual({ RazonSocial: "PROV SA", Giro: "ALIMENTOS", Direccion: "CALLE 1", NombreRepresentanteLegal: "JUAN PÉREZ" });
    expect(await q(`select "Direccion","EncargadoSucursal" from "ProveedoresSucursales"`)).toEqual({ Direccion: "AV. SUR", EncargadoSucursal: "LUIS" });
    expect(await q(`select "Nombres","Apellidos" from "ProveedoresVendedores"`)).toEqual({ Nombres: "PEDRO", Apellidos: "SOTO" });
    expect(await q(`select "NombreBodega" from "Bodegas" where "NombreBodega" ilike 'cocina'`)).toEqual({ NombreBodega: "COCINA" });
    expect(await q(`select "Nombre" from "FormasPago" where "Codigo"='CONTADO'`)).toEqual({ Nombre: "CONTADO" });
    expect(await q(`select count(*)::int n from "Roles" where "NombreRol" = 'Administrador'`)).toEqual({ n: 1 });
  });

  it("aborta si dos bodegas solo difieren en las mayúsculas", async () => {
    const db = await conMigraciones(migs.filter((m) => m < ULTIMA));
    await db.exec(`insert into "Bodegas"("NombreBodega") values ('cocina'),('Cocina');`);
    await expect(db.exec(readFileSync(join(dir, "migrations", ULTIMA), "utf8"))).rejects.toThrow(/mismo nombre salvo mayúsculas/);
  });
});
