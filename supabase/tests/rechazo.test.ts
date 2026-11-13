import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** 0048: rechazar una solicitud exige un motivo de 1 a 100 caracteres, y es la única forma de rechazar. */
const dir = join(__dirname, "..");
let db: PGlite;
const filas = async (sql: string) => (await db.query<any>(sql)).rows;
const falla = (sql: string, re: RegExp) => expect(db.query(sql)).rejects.toThrow(re);
const MSG = /Indique el motivo del rechazo \(máximo 100 caracteres\)/;
/** Una solicitud nueva en el estado pedido (insertada directo: solo importa la máquina de estados). */
async function solicitud(estado: number, solicitante = 2): Promise<number> {
  const r = await filas(`insert into "Solicitudes"("IdUsuarioSolicitante","IdBodegaDestino","EstadoSolicitud") values (${solicitante}, (select min("IdBodega") from "Bodegas" where not "EsCentral"), ${estado}) returning "IdSolicitud" as id`);
  return r[0].id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role authenticator noinherit;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
  await db.exec(`
    insert into "Usuarios"("Rut","Nombres","Apellidos","Correo") values ('1-9','Ana','Gestora','ana@x.cl'), ('2-7','Beto','Solicitante','beto@x.cl');
    insert into "Bodegas"("NombreBodega") values ('COCINA');
  `);
});

describe("0048: rechazar_solicitud", () => {
  it("guarda el motivo recortado, pasa a Rechazada y deja aprobador, fecha e historial", async () => {
    const id = await solicitud(1);
    await db.exec(`select rechazar_solicitud(1, ${id}, '  Sin stock en la bodega central  ')`);
    const s = (await filas(`select "EstadoSolicitud" e, "MotivoRechazo" m, "IdUsuarioAprobador" a, "FechaAprobacion" is not null as f from "Solicitudes" where "IdSolicitud" = ${id}`))[0];
    expect(s).toEqual({ e: 5, m: "Sin stock en la bodega central", a: 1, f: true });
    expect((await filas(`select "EstadoSolicitud" e from "HistorialSolicitudes" where "IdSolicitud" = ${id}`))).toEqual([{ e: 5 }]);
  });

  it("el motivo es obligatorio: vacío o solo espacios se rechaza y la solicitud sigue Enviada", async () => {
    const id = await solicitud(1);
    for (const m of ["", "   "]) await falla(`select rechazar_solicitud(1, ${id}, '${m}')`, MSG);
    await falla(`select rechazar_solicitud(1, ${id}, chr(9) || chr(10))`, MSG); // tabulación y salto de línea
    await falla(`select rechazar_solicitud(1, ${id}, null)`, MSG);
    expect((await filas(`select "EstadoSolicitud" e from "Solicitudes" where "IdSolicitud" = ${id}`))[0].e).toBe(1);
  });

  it("hasta 100 caracteres pasa; 101 se rechaza", async () => {
    const ok = await solicitud(1), mal = await solicitud(1);
    await db.exec(`select rechazar_solicitud(1, ${ok}, '${"a".repeat(100)}')`);
    await falla(`select rechazar_solicitud(1, ${mal}, '${"a".repeat(101)}')`, MSG);
    expect((await filas(`select "EstadoSolicitud" e from "Solicitudes" where "IdSolicitud" = ${mal}`))[0].e).toBe(1);
  });

  it("solo se rechaza desde Enviada", async () => {
    for (const estado of [0, 2, 3, 4, 5]) await falla(`select rechazar_solicitud(1, ${await solicitud(estado)}, 'x')`, /Transición inválida/);
  });

  it("nadie rechaza su propia solicitud", async () => {
    const id = await solicitud(1, 1);
    await falla(`select rechazar_solicitud(1, ${id}, 'x')`, /No puede rechazar su propia solicitud/);
  });

  it("una solicitud inexistente da un mensaje de negocio", async () => {
    await falla(`select rechazar_solicitud(1, 999999, 'x')`, /Solicitud no existe/);
  });

  it("cambiar_estado_solicitud ya no rechaza: no hay forma de rechazar sin motivo", async () => {
    await falla(`select cambiar_estado_solicitud(1, ${await solicitud(1)}, 5::smallint)`, /Transición inválida/);
  });

  it("aprobar y enviar siguen funcionando por cambiar_estado_solicitud", async () => {
    const id = await solicitud(0);
    await expect(db.exec(`select cambiar_estado_solicitud(2, ${id}, 1::smallint)`)).rejects.toThrow(/productos/); // regla previa: sin productos no se envía
  });

  it("el rol de la app ejecuta la función; anon y authenticated no", async () => {
    const id = await solicitud(1), id2 = await solicitud(1);
    await db.exec("set role app_servidor");
    try { await db.query(`select rechazar_solicitud(1, ${id}, 'ok')`); } finally { await db.exec("reset role"); }
    for (const r of ["anon", "authenticated"]) {
      await db.exec(`set role ${r}`);
      try { await expect(db.query(`select rechazar_solicitud(1, ${id2}, 'x')`)).rejects.toThrow(/permission denied/i); } finally { await db.exec("reset role"); }
    }
  });

  it("el check de la columna impide guardar un motivo de más de 100 caracteres o vacío por otro camino", async () => {
    const id = await solicitud(5);
    await falla(`update "Solicitudes" set "MotivoRechazo" = '${"a".repeat(101)}' where "IdSolicitud" = ${id}`, /check/i);
    await falla(`update "Solicitudes" set "MotivoRechazo" = '' where "IdSolicitud" = ${id}`, /check/i);
    await db.exec(`update "Solicitudes" set "MotivoRechazo" = null where "IdSolicitud" = ${id}`); // las rechazadas anteriores quedan sin motivo
  });
});
