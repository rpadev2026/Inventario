import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname, "..");
let db: PGlite;
const q = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(`insert into "Usuarios"("Rut","Nombres","Apellidos","Correo") values ('1-9','A','B','a@x.cl');`);
});

describe("0023 (auditoría): sesiones, limitador y claves", () => {
  it("fijar_clave sube la versión de sesión en cada cambio y guarda el historial", async () => {
    await db.exec(`select fijar_clave(1, 'h1', 1, true)`);
    expect((await q(`select "VersionSesion" v, "DebeCambiar" d from "Claves" where "IdUsuario"=1`))[0]).toEqual({ v: 1, d: true });
    await db.exec(`select fijar_clave(1, 'h2', 1, false)`);
    expect((await q(`select "VersionSesion" v, "DebeCambiar" d, "Password" p from "Claves" where "IdUsuario"=1`))[0]).toEqual({ v: 2, d: false, p: "h2" });
    expect((await q(`select count(*)::int n from "HistorialClaves" where "IdUsuario"=1`))[0].n).toBe(2);
  });

  it("fijar_clave es atómica: si falla el historial no cambia la clave ni la versión", async () => {
    await expect(db.exec(`select fijar_clave(1, null, 1, false)`)).rejects.toThrow();
    expect((await q(`select "VersionSesion" v, "Password" p from "Claves" where "IdUsuario"=1`))[0]).toEqual({ v: 2, p: "h2" });
  });

  it("registrar_fallo_login cuenta, bloquea al llegar al máximo y reinicia el contador", async () => {
    const fallo = () => db.exec(`select registrar_fallo_login(1, 3, 15)`);
    await fallo(); await fallo();
    expect((await q(`select "IntentosFallidos" n, "BloqueadoHasta" b from "Claves" where "IdUsuario"=1`))[0]).toEqual({ n: 2, b: null });
    await fallo();
    const [c] = await q(`select "IntentosFallidos" n, "BloqueadoHasta" > now() as bloqueado from "Claves" where "IdUsuario"=1`);
    expect(c).toEqual({ n: 0, bloqueado: true });
  });

  // Regresión (auditoría de seguridad): fallos de intentos concurrentes que llegan con la cuenta ya bloqueada borraban el candado.
  it("un fallo con la cuenta ya bloqueada no cambia el bloqueo ni el contador (0038)", async () => {
    const estado = async () => (await q(`select "IntentosFallidos" n, "BloqueadoHasta"::text b from "Claves" where "IdUsuario"=1`))[0];
    const antes = await estado();
    expect(antes.b).not.toBeNull();
    for (let i = 0; i < 7; i++) await db.exec(`select registrar_fallo_login(1, 3, 15)`); // más que el máximo
    expect(await estado()).toEqual(antes);
  });

  it("cuando el bloqueo vence, los fallos vuelven a contar desde cero y pueden bloquear de nuevo", async () => {
    await db.exec(`update "Claves" set "BloqueadoHasta" = now() - interval '1 minute' where "IdUsuario"=1`);
    await db.exec(`select registrar_fallo_login(1, 3, 15)`);
    expect((await q(`select "IntentosFallidos" n, "BloqueadoHasta" b from "Claves" where "IdUsuario"=1`))[0]).toEqual({ n: 1, b: null });
    await db.exec(`select registrar_fallo_login(1, 3, 15)`); await db.exec(`select registrar_fallo_login(1, 3, 15)`);
    expect((await q(`select "IntentosFallidos" n, "BloqueadoHasta" > now() as bloqueado from "Claves" where "IdUsuario"=1`))[0]).toEqual({ n: 0, bloqueado: true });
  });

  it("registrar_intento_login permite hasta el máximo y luego niega; expira la ventana", async () => {
    const intento = async (ventana = 60) => (await q(`select registrar_intento_login('1.2.3.4', 3, ${ventana}) ok`))[0].ok;
    expect([await intento(), await intento(), await intento(), await intento()]).toEqual([true, true, true, false]);
    await db.exec(`update "IntentosLogin" set "Desde" = now() - interval '2 minutes'`);
    expect(await intento()).toBe(true); // venció: empieza otra ventana
    await q(`select registrar_intento_login('5.6.7.8', 3, 60)`);
    await db.exec(`update "IntentosLogin" set "Desde" = now() - interval '2 minutes' where "Clave" = '5.6.7.8'`);
    await q(`select registrar_intento_login('9.9.9.9', 3, 60)`);
    expect((await q(`select count(*)::int n from "IntentosLogin" where "Clave" = '5.6.7.8'`))[0].n).toBe(0); // se limpian los vencidos
  });

  it("crear_usuario crea usuario, clave, historial y rol juntos; si el rol no existe no deja nada", async () => {
    const [{ id }] = await q(`select "IdRol" id from "Roles" where "NombreRol" = 'Compras'`);
    const [{ nuevo }] = await q(`select crear_usuario(1, '2-7', 'C', 'D', 'c@x.cl', 'hx', ${id}) nuevo`);
    expect((await q(`select "DebeCambiar" d from "Claves" where "IdUsuario"=${nuevo}`))[0].d).toBe(true);
    expect((await q(`select count(*)::int n from "UsuariosRoles" where "IdUsuario"=${nuevo}`))[0].n).toBe(1);
    expect((await q(`select count(*)::int n from "HistorialClaves" where "IdUsuario"=${nuevo}`))[0].n).toBe(1);

    await expect(db.exec(`select crear_usuario(1, '3-5', 'E', 'F', 'e@x.cl', 'hy', 99999)`)).rejects.toThrow(/rol/i);
    expect((await q(`select count(*)::int n from "Usuarios" where "Rut"='3-5'`))[0].n).toBe(0);
  });

  it("crear_usuario con RUT repetido falla sin dejar clave huérfana", async () => {
    const [{ id }] = await q(`select "IdRol" id from "Roles" where "NombreRol" = 'Compras'`);
    const antes = (await q(`select count(*)::int n from "Claves"`))[0].n;
    await expect(db.exec(`select crear_usuario(1, '2-7', 'C', 'D', 'otro@x.cl', 'hz', ${id})`)).rejects.toThrow();
    expect((await q(`select count(*)::int n from "Claves"`))[0].n).toBe(antes);
  });
});
