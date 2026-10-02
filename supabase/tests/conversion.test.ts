import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname, "..");
let db: PGlite;

type Fila = { Region: string | null; Ciudad: string | null; Comuna: string | null };

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  const migs = readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  const previas = migs.filter((m) => m < "0010");
  const conversion = migs.filter((m) => m.startsWith("0010"));
  expect(conversion).toHaveLength(1);
  for (const m of previas) await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));

  // Datos legados con texto libre, antes de convertir a códigos.
  await db.exec(`
    insert into "Proveedores"("Rut","RazonSocial","Giro","Region","Ciudad","Comuna") values
      ('76086428-5','Completo','x','Región Metropolitana','Santiago','Las Condes'),
      ('1-9','Ñuñoa','x','Región Metropolitana','Santiago','  ÑUÑOA '),
      ('2-7','Sigla','x','RM',null,null),
      ('3-5','SoloRegion','x','Biobío',null,null);
    insert into "ProveedoresSucursales"("IdProveedor","Region","Ciudad","Comuna")
      select "IdProveedor","Region","Ciudad","Comuna" from "Proveedores";
  `);

  await db.exec(readFileSync(join(dir, "migrations", conversion[0]), "utf8"));
});

const esperado: Record<string, Fila> = {
  "Completo": { Region: "13", Ciudad: "131", Comuna: "13114" },
  "Ñuñoa": { Region: "13", Ciudad: "131", Comuna: "13120" },
  "Sigla": { Region: null, Ciudad: null, Comuna: null },
  "SoloRegion": { Region: "08", Ciudad: null, Comuna: null },
};

describe("conversión de texto libre a códigos (migración 0010)", () => {
  it.each(Object.entries(esperado))("Proveedores: %s", async (razon, fila) => {
    const r = await db.query<Fila>(`select "Region","Ciudad","Comuna" from "Proveedores" where "RazonSocial" = $1`, [razon]);
    expect(r.rows).toEqual([fila]);
  });
  it.each(Object.entries(esperado))("ProveedoresSucursales: %s", async (razon, fila) => {
    const r = await db.query<Fila>(
      `select s."Region",s."Ciudad",s."Comuna" from "ProveedoresSucursales" s
         join "Proveedores" p using("IdProveedor") where p."RazonSocial" = $1`, [razon]);
    expect(r.rows).toEqual([fila]);
  });
});
