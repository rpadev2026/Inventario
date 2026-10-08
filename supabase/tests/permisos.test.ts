import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname, "..");
const raiz = join(dir, "..");
let db: PGlite;
const fails = (sql: string, msg?: RegExp) => expect(db.query(sql)).rejects.toThrow(msg);

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
  await db.exec(`insert into "Usuarios"("Rut","Nombres","Apellidos","Correo") values ('1-9','Ana','Admin','ana@x.cl')`);
});

describe("catálogo de permisos (tabla Permisos)", () => {
  it("tiene los 14 permisos con módulo, descripción y orden", async () => {
    const r = (await db.query<any>(`select "Codigo","Modulo","Descripcion","Orden" from "Permisos" order by "Orden"`)).rows;
    expect(r).toHaveLength(14);
    expect(r[0]).toMatchObject({ Codigo: "compras.ver", Modulo: "Compras", Descripcion: "Ver facturas de compra", Orden: 1 });
    expect(r.map((x) => x.Codigo)).toContain("recetas.gestionar");
    expect(new Set(r.map((x) => x.Orden)).size).toBe(14);
  });
  it("RolesPermisos solo acepta permisos del catálogo", async () => {
    await fails(`insert into "RolesPermisos"("IdRol","Permiso") values (1,'inventado.ver')`, /foreign key|Permisos/i);
  });
  it("los permisos que ya tenían los roles base siguen vigentes", async () => {
    const n = Number((await db.query<any>(`select count(*) c from "RolesPermisos"`)).rows[0].c);
    expect(n).toBeGreaterThan(0);
  });
  it("el formato del código se valida", async () => {
    await fails(`insert into "Permisos"("Codigo","Modulo","Descripcion","Orden") values ('XX','M','d',99)`);
  });
  it("guardar_rol rechaza un permiso desconocido con un mensaje de negocio", async () => {
    await fails(`select guardar_rol(1,null,'Nuevo',null,1::smallint,array['compras.ver','inventado.ver'])`, /Permiso desconocido: inventado\.ver/);
    expect(Number((await db.query<any>(`select count(*) c from "Roles" where "NombreRol"='Nuevo'`)).rows[0].c)).toBe(0);
  });
  it("guardar_rol acepta los permisos del catálogo", async () => {
    await db.query(`select guardar_rol(1,null,'Lector',null,1::smallint,array['compras.ver','recetas.ver'])`);
  });
});

/** Todos los .ts/.tsx de la aplicación (sin pruebas ni node_modules). */
function fuentes(d: string): string[] {
  return readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    if (statSync(p).isDirectory()) return f === "node_modules" || f === ".next" ? [] : fuentes(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f) ? [p] : [];
  });
}

describe("los permisos que usa el código existen en la tabla", () => {
  it("requerirPermiso, requerirPaginaPermiso, tienePermiso, el menú y los avisos usan solo códigos del catálogo", async () => {
    const codigos = new Set((await db.query<any>(`select "Codigo" from "Permisos"`)).rows.map((r) => r.Codigo as string));
    const usados = new Map<string, string>();
    const llamadas = /(?:requerirPermiso|requerirPaginaPermiso|correosPorPermiso)\(([^)]*)\)|tienePermiso\([^,)]+,([^)]*)\)|permisos:\s*\[([^\]]*)\]/g;
    for (const f of [...fuentes(join(raiz, "app")), ...fuentes(join(raiz, "lib")), ...fuentes(join(raiz, "components"))]) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(llamadas))
        for (const lit of (m[1] ?? m[2] ?? m[3] ?? "").matchAll(/"([^"]+)"/g))
          if (lit[1] !== "admin") usados.set(lit[1], f);
    }
    expect(usados.size).toBeGreaterThan(10); // la búsqueda realmente encontró los usos
    const desconocidos = [...usados].filter(([c]) => !codigos.has(c)).map(([c, f]) => `${c} (${f})`);
    expect(desconocidos).toEqual([]);
  });
});
