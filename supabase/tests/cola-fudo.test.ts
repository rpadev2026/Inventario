import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Migración 0043: cola de sincronización de Fudo (un trabajo activo, reclamo con latido, cierre) y faltantes paginados en la base. */
const dir = join(__dirname, "..");
let db: PGlite;
const q = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
const val = async (sql: string, params: unknown[] = []) => Object.values((await q(sql, params))[0])[0] as any;
const encolar = async (origen = "manual") => (await q(`select encolar_trabajo_fudo(null, $1) r`, [origen]))[0].r as { id: number; nuevo: boolean };
const reclamar = () => q(`select * from reclamar_trabajo_fudo()`);
const fila = async (id: number) => (await q(`select "Estado" e, "Intentos" i, "Error" err, "Resumen" r, "FechaFin" is not null as fin from "TrabajosFudo" where "IdTrabajo"=$1`, [id]))[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
});

describe("0043: cola de sincronización de Fudo", () => {
  it("solo hay un trabajo activo: pedir otro devuelve el mismo", async () => {
    const a = await encolar();
    expect(a.nuevo).toBe(true);
    const b = await encolar("cron");
    expect(b).toEqual({ id: a.id, nuevo: false });
    await reclamar(); await q(`select terminar_trabajo_fudo($1, '{}'::jsonb, null)`, [a.id]);
  });

  it("reclamar toma el pendiente una sola vez y lo deja en curso; terminar lo cierra con su resumen", async () => {
    const a = await encolar();
    const [t] = await reclamar();
    expect(t.IdTrabajo).toBe(a.id);
    expect(await reclamar()).toEqual([]); // otro proceso no lo toma mientras late
    expect((await fila(a.id)).e).toBe(1);
    await q(`select latido_trabajo_fudo($1, '{"revisadas":3,"total":10}'::jsonb)`, [a.id]);
    expect((await fila(a.id)).r).toEqual({ revisadas: 3, total: 10 });
    await q(`select terminar_trabajo_fudo($1, '{"revisadas":10,"total":10}'::jsonb, null)`, [a.id]);
    const f = await fila(a.id);
    expect(f).toMatchObject({ e: 2, fin: true, err: null });
    expect(f.r).toEqual({ revisadas: 10, total: 10 });
    expect((await encolar()).nuevo).toBe(true); // con el anterior cerrado se puede pedir otro
    await reclamar(); await q(`select terminar_trabajo_fudo(${(await q(`select max("IdTrabajo") m from "TrabajosFudo"`))[0].m}, null, null)`);
  });

  it("un error deja el trabajo en estado 3 con el mensaje", async () => {
    const a = await encolar(); await reclamar();
    await q(`select terminar_trabajo_fudo($1, null, 'Fudo caído')`, [a.id]);
    expect(await fila(a.id)).toMatchObject({ e: 3, err: "Fudo caído" });
  });

  it("un trabajo en curso sin latido hace más de 5 minutos se retoma; al tercer intento se da por fallido", async () => {
    const a = await encolar(); await reclamar();
    await q(`update "TrabajosFudo" set "Latido" = now() - interval '6 minutes' where "IdTrabajo"=$1`, [a.id]);
    expect((await reclamar())[0].IdTrabajo).toBe(a.id);
    expect((await fila(a.id)).i).toBe(2);
    await q(`update "TrabajosFudo" set "Latido" = now() - interval '6 minutes' where "IdTrabajo"=$1`, [a.id]);
    expect((await reclamar())[0].IdTrabajo).toBe(a.id);
    expect((await fila(a.id)).i).toBe(3);
    await q(`update "TrabajosFudo" set "Latido" = now() - interval '6 minutes' where "IdTrabajo"=$1`, [a.id]);
    expect(await reclamar()).toEqual([]);
    expect(await fila(a.id)).toMatchObject({ e: 3, fin: true });
  });

  it("estado_trabajo_fudo informa el activo y el último terminado", async () => {
    const a = await encolar();
    const e = await val(`select estado_trabajo_fudo()`);
    expect(e.actual.IdTrabajo).toBe(a.id);
    expect(e.ultimo.Estado).toBe(3);
    await reclamar(); await q(`select terminar_trabajo_fudo($1, null, null)`, [a.id]);
    const f = await val(`select estado_trabajo_fudo()`);
    expect(f.actual).toBeNull();
    expect(f.ultimo.IdTrabajo).toBe(a.id);
  });

  it("conserva solo los 30 últimos terminados", async () => {
    for (let i = 0; i < 35; i++) { const t = await encolar(); await reclamar(); await q(`select terminar_trabajo_fudo($1, null, null)`, [t.id]); }
    expect(Number(await val(`select count(*) from "TrabajosFudo"`))).toBe(30);
  });
});

describe("0043: faltantes_ventas_fudo", () => {
  beforeAll(async () => {
    await db.exec(`
      insert into "VentasFudo"("IdVentaFudo","FechaCierre","Omitidos") values
       ('V1','2026-10-01T10:00:00Z','[{"producto":"1","nombre":"Viejo","cantidad":2,"motivo":"sin receta"},{"producto":"2","nombre":"Pizza","cantidad":1,"motivo":"sin bodega"}]'),
       ('V2','2026-10-02T10:00:00Z','[{"producto":"1","nombre":"Nuevo","cantidad":3,"motivo":"sin bodega"}]'),
       ('V3','2026-10-03T10:00:00Z','[]');`);
  });
  it("suma por producto de Fudo con el nombre y el motivo de la venta más reciente, de mayor a menor cantidad", async () => {
    const r = await val(`select faltantes_ventas_fudo(0, 10)`);
    expect(r.total).toBe(2);
    expect(r.filas).toEqual([
      { producto: "1", nombre: "Nuevo", motivo: "sin bodega", cantidad: 5 },
      { producto: "2", nombre: "Pizza", motivo: "sin bodega", cantidad: 1 },
    ]);
  });
  it("pagina: el total no cambia y el desplazamiento corta la lista", async () => {
    const r = await val(`select faltantes_ventas_fudo(1, 1)`);
    expect(r.total).toBe(2);
    expect(r.filas.map((f: any) => f.producto)).toEqual(["2"]);
    expect((await val(`select faltantes_ventas_fudo(5, 10)`)).filas).toEqual([]);
  });
});
