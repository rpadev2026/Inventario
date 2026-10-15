import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname, "..");
const raiz = join(dir, "..");
let db: PGlite;
const filas = async (sql: string) => (await db.query<any>(sql)).rows;

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  // Supabase concede por defecto acceso a anon/authenticated sobre todo lo que se cree en public:
  // se reproduce aquí para que la prueba detecte cualquier objeto que ninguna migración proteja.
  for (const ambito of ["", "in schema public"]) {
    await db.exec(`
      alter default privileges for role postgres ${ambito} grant all on tables to anon, authenticated;
      alter default privileges for role postgres ${ambito} grant all on sequences to anon, authenticated;
      alter default privileges for role postgres ${ambito} grant all on functions to anon, authenticated;
    `);
  }
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  // Objetos que una migración futura crearía sin pensar en permisos.
  await db.exec(`create table "TablaNueva"(id int); create sequence "SecNueva"; create function f_nueva() returns int language sql as 'select 1';`);
});

describe("S08: los roles públicos (anon, authenticated) no acceden a nada", () => {
  it("ninguna tabla tiene privilegios ni deja de tener RLS (salvo la creada sin RLS a propósito en esta prueba)", async () => {
    const con = await filas(`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'TablaNueva'
        and (has_table_privilege('anon', c.oid, 'select,insert,update,delete') or has_table_privilege('authenticated', c.oid, 'select,insert,update,delete'))`);
    expect(con).toEqual([]);
    const sinRls = await filas(`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity and c.relname <> 'TablaNueva'`);
    expect(sinRls).toEqual([]);
  });

  it("ninguna secuencia ni función es utilizable por esos roles", async () => {
    expect(await filas(`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'S'
        and (has_sequence_privilege('anon', c.oid, 'usage,select,update') or has_sequence_privilege('authenticated', c.oid, 'usage,select,update'))`)).toEqual([]);
    expect(await filas(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f'
        and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`)).toEqual([]);
  });

  it("lo que se cree después (tabla, secuencia, función) ya nace sin acceso para esos roles", async () => {
    const [t] = await filas(`select has_table_privilege('anon', '"TablaNueva"', 'select') a, has_table_privilege('authenticated', '"TablaNueva"', 'select') b`);
    const [s] = await filas(`select has_sequence_privilege('anon', '"SecNueva"', 'usage') a`);
    const [f] = await filas(`select has_function_privilege('anon', 'f_nueva()', 'execute') a, has_function_privilege('authenticated', 'f_nueva()', 'execute') b`);
    expect([t.a, t.b, s.a, f.a, f.b]).toEqual([false, false, false, false, false]);
  });
});

describe("S08: toda server action comprueba la autorización", () => {
  const archivos = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? archivos(p) : n === "actions.ts" ? [p] : [];
    });
  // Acciones públicas a propósito: autentican con las credenciales del formulario.
  const PUBLICAS = new Set(["login", "logout"]);
  const AUTORIZA = /\b(requerirPermiso|requerirAdmin|leerSesion)\(/;

  it("cada función exportada de un actions.ts llama requerirPermiso, requerirAdmin o leerSesion", () => {
    const sinAuth: string[] = [];
    let total = 0;
    for (const f of archivos(join(raiz, "app"))) {
      const src = readFileSync(f, "utf8");
      const cortes = [...src.matchAll(/^export async function (\w+)/gm)];
      cortes.forEach((m, i) => {
        total++;
        const cuerpo = src.slice(m.index!, cortes[i + 1]?.index ?? src.length);
        if (!PUBLICAS.has(m[1]) && !AUTORIZA.test(cuerpo)) sinAuth.push(`${f.replace(raiz, "")}: ${m[1]}`);
      });
    }
    expect(total).toBeGreaterThanOrEqual(25); // el recorrido sí encontró las acciones (hay 28)
    expect(sinAuth).toEqual([]);
  });

  it("los archivos 'use server' que no son actions.ts tampoco existen sin revisar", () => {
    const otros: string[] = [];
    const recorrer = (d: string) => readdirSync(d).forEach((n) => {
      const p = join(d, n);
      if (n === "node_modules" || n === ".next") return;
      if (statSync(p).isDirectory()) return recorrer(p);
      if (/\.(ts|tsx)$/.test(n) && n !== "actions.ts" && /^\s*["']use server["']/.test(readFileSync(p, "utf8"))) otros.push(p.replace(raiz, ""));
    });
    ["app", "lib", "components"].forEach((d) => recorrer(join(raiz, d)));
    expect(otros).toEqual([]);
  });
});
