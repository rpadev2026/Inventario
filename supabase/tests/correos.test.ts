import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname, "..");
let db: PGlite;
const q = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
const nuevo = async (clave: string | null = null) =>
  (await q(`insert into "CorreosPendientes"("Para","Asunto","Html","ClaveUnica") values (array['a@x.cl'],'As','<p>h</p>',$1) returning "IdCorreo" id`, [clave]))[0].id as number;
const fila = async (id: number) => (await q(`select "Estado" e, "Intentos" i, "UltimoError" u, "FechaEnvio" is not null as enviado from "CorreosPendientes" where "IdCorreo"=$1`, [id]))[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
});

describe("0025: cola de correos", () => {
  it("el mismo aviso (ClaveUnica) no se encola dos veces", async () => {
    await nuevo("enviada:1");
    await expect(nuevo("enviada:1")).rejects.toThrow(/unique|duplicate/i);
  });

  it("reclamar arrienda: un segundo proceso no toma el mismo correo y cuenta el intento", async () => {
    const id = await nuevo();
    const a = await q(`select * from reclamar_correos(10)`);
    expect(a.map((c) => c.IdCorreo)).toContain(id);
    expect((await q(`select * from reclamar_correos(10)`)).map((c) => c.IdCorreo)).not.toContain(id);
    expect((await fila(id)).i).toBe(1);
    await q(`select resolver_correo($1, true, null)`, [id]);
    expect(await fila(id)).toMatchObject({ e: 1, enviado: true });
  });

  it("un fallo se reintenta con espera creciente y, al llegar al máximo, queda fallido", async () => {
    const id = await nuevo();
    await q(`select * from reclamar_correos(10)`); // intento 1
    await q(`select resolver_correo($1, false, 'timeout', 3)`, [id]);
    const [p1] = await q(`select "Estado" e, "ProximoIntento" > now() + interval '1 minute' as espera from "CorreosPendientes" where "IdCorreo"=$1`, [id]);
    expect(p1).toEqual({ e: 0, espera: true }); // sigue pendiente, para más adelante
    expect((await q(`select * from reclamar_correos(10)`)).map((c) => c.IdCorreo)).not.toContain(id); // aún no vence

    await q(`update "CorreosPendientes" set "ProximoIntento" = now() where "IdCorreo"=$1`, [id]);
    await q(`select * from reclamar_correos(10)`); // intento 2
    await q(`select resolver_correo($1, false, 'timeout', 3)`, [id]);
    await q(`update "CorreosPendientes" set "ProximoIntento" = now() where "IdCorreo"=$1`, [id]);
    await q(`select * from reclamar_correos(10)`); // intento 3 = máximo
    await q(`select resolver_correo($1, false, 'timeout final', 3)`, [id]);
    expect(await fila(id)).toMatchObject({ e: 2, i: 3, u: "timeout final" });
    await q(`update "CorreosPendientes" set "ProximoIntento" = now() where "IdCorreo"=$1`, [id]);
    expect((await q(`select * from reclamar_correos(10)`)).map((c) => c.IdCorreo)).not.toContain(id); // fallido: no se reintenta
  });

  it("un correo ya enviado no vuelve a cambiar de estado", async () => {
    const id = await nuevo();
    await q(`select * from reclamar_correos(10)`);
    await q(`select resolver_correo($1, true, null)`, [id]);
    await q(`select resolver_correo($1, false, 'tarde', 5)`, [id]);
    expect((await fila(id)).e).toBe(1);
  });
});
