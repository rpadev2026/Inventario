import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** 0047: suscripciones push. La tabla solo se toca por funciones; el destinatario sale del permiso, no del nombre del rol. */
const dir = join(__dirname, "..");
let db: PGlite;
const filas = async (sql: string) => (await db.query<any>(sql)).rows;
const como = async (sql: string) => { await db.exec("set role app_servidor"); try { return await db.query<any>(sql); } finally { await db.exec("reset role"); } };

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role authenticator noinherit;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
  await db.exec(`
    insert into "Usuarios"("Rut","Nombres","Apellidos","Correo") values
      ('1-9','Ana','Admin','ana@x.cl'), ('2-7','Beto','Bodega','beto@x.cl'), ('3-5','Cami','Compras','cami@x.cl'), ('4-3','Dani','Inactivo','dani@x.cl'), ('5-1','Eli','Soli','eli@x.cl');
    update "Usuarios" set "IdEstado" = 0 where "Correo" = 'dani@x.cl';
  `);
  const id = async (c: string) => (await filas(`select "IdUsuario" i from "Usuarios" where "Correo"='${c}'`))[0].i as number;
  const rol = async (n: string) => (await filas(`select "IdRol" i from "Roles" where "NombreRol"='${n}'`))[0].i as number;
  const dar = async (c: string, r: string) => db.exec(`insert into "UsuariosRoles"("IdUsuario","IdRol") values (${await id(c)}, ${await rol(r)})`);
  await dar("ana@x.cl", "Administrador");
  await dar("beto@x.cl", "Bodeguero Central");
  await dar("cami@x.cl", "Compras");
  await dar("dani@x.cl", "Bodeguero Central");
  await dar("eli@x.cl", "Solicitante");
});

const uid = async (c: string) => (await filas(`select "IdUsuario" i from "Usuarios" where "Correo"='${c}'`))[0].i as number;

describe("0047: suscripciones push", () => {
  it("guardar dos veces el mismo endpoint deja una sola fila", async () => {
    const u = await uid("beto@x.cl");
    await db.exec(`select guardar_suscripcion_push(${u}, 'https://push.x/1', 'k1', 'a1'); select guardar_suscripcion_push(${u}, 'https://push.x/1', 'k2', 'a2')`);
    const r = await filas(`select "P256dh" from "SuscripcionesPush" where "Endpoint"='https://push.x/1'`);
    expect(r).toEqual([{ P256dh: "k2" }]);
  });

  it("el mismo dispositivo (endpoint) pasa al usuario que inició sesión después, sin duplicarse", async () => {
    const a = await uid("ana@x.cl"), b = await uid("beto@x.cl");
    await db.exec(`select guardar_suscripcion_push(${a}, 'https://push.x/compartido', 'k', 'a'); select guardar_suscripcion_push(${b}, 'https://push.x/compartido', 'k', 'a')`);
    expect(await filas(`select "IdUsuario" from "SuscripcionesPush" where "Endpoint"='https://push.x/compartido'`)).toEqual([{ IdUsuario: b }]);
  });

  it("quitar borra la suscripción", async () => {
    await db.exec(`select quitar_suscripcion_push('https://push.x/1')`);
    expect(await filas(`select 1 from "SuscripcionesPush" where "Endpoint"='https://push.x/1'`)).toEqual([]);
  });

  it("suscripciones_push_usuarios trae solo las de esos usuarios", async () => {
    const e = await uid("eli@x.cl"), c = await uid("cami@x.cl");
    await db.exec(`select guardar_suscripcion_push(${e}, 'https://push.x/eli', 'k', 'a'); select guardar_suscripcion_push(${c}, 'https://push.x/cami', 'k', 'a')`);
    const r = await filas(`select "Endpoint" from suscripciones_push_usuarios(array[${e}]::bigint[])`);
    expect(r).toEqual([{ Endpoint: "https://push.x/eli" }]);
  });

  it("suscripciones_push_permiso trae al Administrador y a roles con el permiso; no a inactivos ni a roles sin el permiso", async () => {
    for (const [c, ep] of [["ana@x.cl", "admin"], ["beto@x.cl", "bodega"], ["dani@x.cl", "inactivo"]] as const)
      await db.exec(`select guardar_suscripcion_push(${await uid(c)}, 'https://push.x/p-${ep}', 'k', 'a')`);
    const r = (await filas(`select "Endpoint" from suscripciones_push_permiso('solicitudes.gestionar')`)).map((x) => x.Endpoint as string).filter((e) => e.includes("/p-")).sort();
    expect(r).toEqual(["https://push.x/p-admin", "https://push.x/p-bodega"]);
    // Solicitante y Compras no tienen solicitudes.gestionar.
    const todas = (await filas(`select "Endpoint" from suscripciones_push_permiso('solicitudes.gestionar')`)).map((x) => x.Endpoint as string);
    expect(todas).not.toContain("https://push.x/eli");
    expect(todas).not.toContain("https://push.x/cami");
  });

  it("suscripciones_push_permiso puede excluir a quien originó el aviso", async () => {
    const a = await uid("ana@x.cl");
    const r = (await filas(`select "Endpoint" from suscripciones_push_permiso('solicitudes.gestionar', ${a})`)).map((x) => x.Endpoint as string);
    expect(r).not.toContain("https://push.x/p-admin");
    expect(r).toContain("https://push.x/p-bodega");
  });

  it("el rol de la app no lee ni escribe la tabla directo, pero sí usa las funciones", async () => {
    await expect(como(`select * from "SuscripcionesPush"`)).rejects.toThrow(/permission denied|row-level security/i);
    await expect(como(`insert into "SuscripcionesPush"("IdUsuario","Endpoint","P256dh","Auth") values (1,'x','k','a')`)).rejects.toThrow(/permission denied|row-level security/i);
    await expect(como(`select * from suscripciones_push_permiso('solicitudes.gestionar')`)).resolves.toBeDefined();
    await expect(como(`select guardar_suscripcion_push(1, 'https://push.x/app', 'k', 'a')`)).resolves.toBeDefined();
    await expect(como(`select quitar_suscripcion_push('https://push.x/app')`)).resolves.toBeDefined();
  });

  it("anon y authenticated no ejecutan las funciones", async () => {
    for (const f of ["guardar_suscripcion_push(1,'x','k','a')", "quitar_suscripcion_push('x')", "suscripciones_push_usuarios(array[1]::bigint[])", "suscripciones_push_permiso('x', null)"]) {
      for (const r of ["anon", "authenticated"]) {
        await db.exec(`set role ${r}`);
        await expect(db.query(`select ${f.startsWith("susc") ? "* from " : ""}${f}`)).rejects.toThrow(/permission denied/i);
        await db.exec("reset role");
      }
    }
  });
});
