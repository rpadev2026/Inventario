import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { MOTIVO_CADUCIDAD } from "../../lib/aprobacion-parcial";

/** 0049: aprobación parcial (estado 6) → re-aprobación o cierre del Administrador (estado 7) → cierre por caducidad a los 7 días. */
const dir = join(__dirname, "..");
let db: PGlite;
const filas = async (sql: string) => (await db.query<any>(sql)).rows;
const falla = (sql: string, re: RegExp) => expect(db.query(sql)).rejects.toThrow(re);
const ADMIN = 1, SOLICITANTE = 2, GESTOR = 3, ADMIN2 = 4, ADMIN_INACTIVO = 5;
let prod1 = 0, prod2 = 0;

/** Solicitud insertada directo en el estado pedido, con 100 de PROD1 y 50 de PROD2 pedidos. */
async function solicitud(estado: number, o: { solicitante?: number; haceDias?: number } = {}): Promise<number> {
  const fecha = o.haceDias === undefined ? "null" : `now() - interval '${o.haceDias} days'`;
  const r = await filas(`insert into "Solicitudes"("IdUsuarioSolicitante","IdBodegaDestino","EstadoSolicitud","FechaAprobacion","MotivoParcial") values (${o.solicitante ?? SOLICITANTE}, (select min("IdBodega") from "Bodegas" where not "EsCentral"), ${estado}, ${fecha}, ${estado === 6 ? "'Falta stock'" : "null"}) returning "IdSolicitud" as id`);
  const id = r[0].id as number;
  await db.exec(`insert into "SolicitudesDetalle"("IdSolicitud","IdProducto","Cantidad") values (${id}, ${prod1}, 100), (${id}, ${prod2}, 50)`);
  return id;
}
const items = (a: number, b: number) => `'[{"producto":${prod1},"cantidad":${a}},{"producto":${prod2},"cantidad":${b}}]'::jsonb`;
const estado = async (id: number) => (await filas(`select "EstadoSolicitud" e from "Solicitudes" where "IdSolicitud" = ${id}`))[0].e as number;
const fila = async (id: number) => (await filas(`select * from "Solicitudes" where "IdSolicitud" = ${id}`))[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role authenticator noinherit;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
  await db.exec(`
    insert into "Usuarios"("Rut","Nombres","Apellidos","Correo") values ('1-9','Ana','Admin','ana@x.cl'), ('2-7','Beto','Solicitante','beto@x.cl'), ('3-5','Cami','Gestora','cami@x.cl'), ('4-3','Dani','Admin2','dani@x.cl'), ('5-1','Eli','Inactiva','eli@x.cl');
    update "Usuarios" set "IdEstado" = 0 where "IdUsuario" = ${ADMIN_INACTIVO};
    insert into "Bodegas"("NombreBodega") values ('COCINA');
    insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values ('P1','HARINA','G','BOLSA'), ('P2','SAL','G','BOLSA');
  `);
  prod1 = (await filas(`select "IdProducto" i from "Productos" where "Codigo"='P1'`))[0].i;
  prod2 = (await filas(`select "IdProducto" i from "Productos" where "Codigo"='P2'`))[0].i;
  await db.exec(`insert into "StockBodega"("IdBodega","IdProducto","Cantidad") select "IdBodega", p, 100 from "Bodegas", unnest(array[${prod1}, ${prod2}]) p where "EsCentral"`);
  const rol = async (n: string) => (await filas(`select "IdRol" i from "Roles" where "NombreRol"='${n}'`))[0].i as number;
  const dar = async (u: number, r: string) => db.exec(`insert into "UsuariosRoles"("IdUsuario","IdRol") values (${u}, ${await rol(r)})`);
  await dar(ADMIN, "Administrador"); await dar(ADMIN2, "Administrador"); await dar(ADMIN_INACTIVO, "Administrador");
  await dar(SOLICITANTE, "Solicitante"); await dar(GESTOR, "Bodeguero Central");
});

describe("0049: aprobar total y aprobación parcial", () => {
  it("aprobar_solicitud con una cantidad menor a la pedida o un producto sin informar falla: hay que aprobar parcialmente", async () => {
    const id = await solicitud(1);
    await falla(`select aprobar_solicitud(${GESTOR}, ${id}, ${items(40, 50)})`, /Hay cantidades menores a las pedidas/);
    await falla(`select aprobar_solicitud(${GESTOR}, ${id}, '[{"producto":${prod1},"cantidad":100}]'::jsonb)`, /Hay cantidades menores a las pedidas/);
    expect(await estado(id)).toBe(1);
    expect((await filas(`select count(*)::int c from "SolicitudesDetalle" where "IdSolicitud" = ${id} and "CantidadAprobada" is not null`))[0].c).toBe(0); // todo se revirtió
  });

  it("aprobar_solicitud con todo igual a lo pedido sigue funcionando (estado 2)", async () => {
    const id = await solicitud(1);
    await db.exec(`select aprobar_solicitud(${GESTOR}, ${id}, ${items(100, 50)})`);
    expect(await estado(id)).toBe(2);
  });

  it("aprobar parcialmente: estado 6, motivo recortado, aprobador, fecha, cantidades e historial", async () => {
    const id = await solicitud(1);
    await db.exec(`select aprobar_parcial_solicitud(${GESTOR}, ${id}, ${items(40, 50)}, '  Poco stock  ')`);
    const s = await fila(id);
    expect(s).toMatchObject({ EstadoSolicitud: 6, MotivoParcial: "Poco stock", IdUsuarioAprobador: GESTOR });
    expect(s.FechaAprobacion).not.toBeNull();
    expect((await filas(`select "IdProducto" p, "CantidadAprobada" c from "SolicitudesDetalle" where "IdSolicitud" = ${id} order by 1`)).map((r) => Number(r.c))).toEqual([40, 50]);
    expect((await filas(`select "EstadoSolicitud" e, "IdUsuarioCreacion" u from "HistorialSolicitudes" where "IdSolicitud" = ${id}`))).toEqual([{ e: 6, u: GESTOR }]);
  });

  it("el motivo de la aprobación parcial es obligatorio y de hasta 100 caracteres", async () => {
    const id = await solicitud(1);
    const MSG = /Indique el motivo de la aprobación parcial \(máximo 100 caracteres\)/;
    await falla(`select aprobar_parcial_solicitud(${GESTOR}, ${id}, ${items(40, 50)}, '')`, MSG);
    await falla(`select aprobar_parcial_solicitud(${GESTOR}, ${id}, ${items(40, 50)}, '   ')`, MSG);
    await falla(`select aprobar_parcial_solicitud(${GESTOR}, ${id}, ${items(40, 50)}, chr(9) || chr(10))`, MSG);
    await falla(`select aprobar_parcial_solicitud(${GESTOR}, ${id}, ${items(40, 50)}, null)`, MSG);
    await falla(`select aprobar_parcial_solicitud(${GESTOR}, ${id}, ${items(40, 50)}, '${"a".repeat(101)}')`, MSG);
    expect(await estado(id)).toBe(1);
    await db.exec(`select aprobar_parcial_solicitud(${GESTOR}, ${id}, ${items(40, 50)}, '${"a".repeat(100)}')`);
    expect(await estado(id)).toBe(6);
  });

  it("la vía parcial sin ninguna cantidad menor falla: hay que usar Aprobar", async () => {
    const id = await solicitud(1);
    await falla(`select aprobar_parcial_solicitud(${GESTOR}, ${id}, ${items(100, 50)}, 'x')`, /No hay cantidades menores a las pedidas/);
    expect(await estado(id)).toBe(1);
  });

  it("valida stock, tope por producto y al menos un producto, igual que la aprobación total", async () => {
    const id = await solicitud(1);
    await falla(`select aprobar_parcial_solicitud(${GESTOR}, ${id}, ${items(101, 10)}, 'x')`, /inválida/);
    await falla(`select aprobar_parcial_solicitud(${GESTOR}, ${id}, ${items(0, 0)}, 'x')`, /al menos un producto/);
  });

  it("nadie aprueba parcialmente su propia solicitud, y solo desde Enviada", async () => {
    await falla(`select aprobar_parcial_solicitud(${SOLICITANTE}, ${await solicitud(1)}, ${items(40, 50)}, 'x')`, /No puede aprobar su propia solicitud/);
    for (const e of [0, 2, 6]) await falla(`select aprobar_parcial_solicitud(${GESTOR}, ${await solicitud(e)}, ${items(40, 50)}, 'x')`, /no está en estado Enviada/);
  });
});

describe("0049: re-aprobación del Administrador", () => {
  it("el Administrador re-aprueba: pasa a Aprobada (2) con las cantidades parciales, él queda como aprobador", async () => {
    const id = await solicitud(1);
    await db.exec(`select aprobar_parcial_solicitud(${GESTOR}, ${id}, ${items(40, 50)}, 'x')`);
    await db.exec(`select reaprobar_solicitud(${ADMIN}, ${id})`);
    expect(await fila(id)).toMatchObject({ EstadoSolicitud: 2, IdUsuarioAprobador: ADMIN });
    expect((await filas(`select "CantidadAprobada" c from "SolicitudesDetalle" where "IdSolicitud" = ${id} order by "IdProducto"`)).map((r) => Number(r.c))).toEqual([40, 50]);
    expect((await filas(`select "EstadoSolicitud" e from "HistorialSolicitudes" where "IdSolicitud" = ${id} order by "IdHistorial"`)).map((r) => r.e)).toEqual([6, 2]);
  });

  it("solo el rol Administrador: el gestor, el solicitante y un Administrador inactivo no pueden", async () => {
    const id = await solicitud(6);
    for (const u of [GESTOR, SOLICITANTE, ADMIN_INACTIVO]) await falla(`select reaprobar_solicitud(${u}, ${id})`, /Solo el Administrador/);
    expect(await estado(id)).toBe(6);
  });

  it("nadie re-aprueba su propia solicitud, ni desde un estado distinto de 6", async () => {
    await falla(`select reaprobar_solicitud(${ADMIN}, ${await solicitud(6, { solicitante: ADMIN })})`, /No puede aprobar su propia solicitud/);
    for (const e of [1, 2, 5, 7]) await falla(`select reaprobar_solicitud(${ADMIN}, ${await solicitud(e)})`, /no está en estado Aprobada parcialmente/);
  });

  it("revalida el stock de la Bodega Central: si ya no alcanza, no se aprueba", async () => {
    const id = await solicitud(6);
    await db.exec(`update "SolicitudesDetalle" set "CantidadAprobada" = 60 where "IdSolicitud" = ${id} and "IdProducto" = ${prod1}`);
    await db.exec(`update "StockBodega" set "Cantidad" = 10 where "IdProducto" = ${prod1} and "IdBodega" = (select "IdBodega" from "Bodegas" where "EsCentral")`);
    await falla(`select reaprobar_solicitud(${ADMIN}, ${id})`, /Stock insuficiente en Bodega Central/);
    expect(await estado(id)).toBe(6);
    await db.exec(`update "StockBodega" set "Cantidad" = 100 where "IdProducto" = ${prod1} and "IdBodega" = (select "IdBodega" from "Bodegas" where "EsCentral")`);
  });
});

describe("0049: cierre por el Administrador", () => {
  it("cierra con motivo: estado 7, motivo recortado, fecha, quién cerró e historial", async () => {
    const id = await solicitud(6);
    await db.exec(`select cerrar_solicitud(${ADMIN}, ${id}, '  Ya no se necesita  ')`);
    const s = await fila(id);
    expect(s).toMatchObject({ EstadoSolicitud: 7, MotivoCierre: "Ya no se necesita", IdUsuarioCierre: ADMIN });
    expect(s.FechaCierre).not.toBeNull();
    expect((await filas(`select "EstadoSolicitud" e, "IdUsuarioCreacion" u from "HistorialSolicitudes" where "IdSolicitud" = ${id}`))).toEqual([{ e: 7, u: ADMIN }]);
  });

  it("el motivo del cierre es obligatorio (1 a 100)", async () => {
    const id = await solicitud(6);
    const MSG = /Indique el motivo del cierre \(máximo 100 caracteres\)/;
    for (const m of ["''", "'   '", "chr(9) || chr(10)", "null", `'${"a".repeat(101)}'`]) await falla(`select cerrar_solicitud(${ADMIN}, ${id}, ${m})`, MSG);
    expect(await estado(id)).toBe(6);
  });

  it("solo el rol Administrador y solo desde Aprobada parcialmente", async () => {
    for (const u of [GESTOR, SOLICITANTE]) await falla(`select cerrar_solicitud(${u}, ${await solicitud(6)}, 'x')`, /Solo el Administrador/);
    for (const e of [1, 2, 5, 7]) await falla(`select cerrar_solicitud(${ADMIN}, ${await solicitud(e)}, 'x')`, /no está en estado Aprobada parcialmente/);
  });

  it("el Administrador sí puede cerrar una solicitud propia", async () => {
    const id = await solicitud(6, { solicitante: ADMIN });
    await db.exec(`select cerrar_solicitud(${ADMIN}, ${id}, 'x')`);
    expect(await estado(id)).toBe(7);
  });

  it("el check de columnas impide motivos de más de 100 caracteres o vacíos por otro camino", async () => {
    const id = await solicitud(6);
    await falla(`update "Solicitudes" set "MotivoParcial" = '' where "IdSolicitud" = ${id}`, /check/i);
    await falla(`update "Solicitudes" set "MotivoCierre" = '${"a".repeat(101)}' where "IdSolicitud" = ${id}`, /check/i);
  });
});

describe("0049: cierre por caducidad", () => {
  it("cierra solo las Aprobadas parcialmente de 7 días o más: 6 d 23 h no, 7 d 1 min sí", async () => {
    const reciente = await solicitud(6, { haceDias: 6 });
    await db.exec(`update "Solicitudes" set "FechaAprobacion" = now() - interval '6 days 23 hours' where "IdSolicitud" = ${reciente}`);
    const vencida = await solicitud(6);
    await db.exec(`update "Solicitudes" set "FechaAprobacion" = now() - interval '7 days 1 minute' where "IdSolicitud" = ${vencida}`);
    const otras = [await solicitud(1, { haceDias: 30 }), await solicitud(2, { haceDias: 30 }), await solicitud(5, { haceDias: 30 })];
    const r = await filas(`select * from cerrar_solicitudes_caducadas()`);
    expect(r.map((x) => x.IdSolicitud)).toEqual([vencida]);
    expect(await estado(reciente)).toBe(6);
    expect(await estado(vencida)).toBe(7);
    for (const o of otras) expect([1, 2, 5]).toContain(await estado(o));
    const v = await fila(vencida);
    expect(v).toMatchObject({ MotivoCierre: MOTIVO_CADUCIDAD, IdUsuarioCierre: null }); // el texto de SQL y el del aviso son el mismo
    expect(v.FechaCierre).not.toBeNull();
    expect(r[0]).toHaveProperty("Token");
    expect(r[0]).toHaveProperty("NumeroSolicitud");
  });

  it("deja historial sin usuario y es idempotente: una segunda llamada no cierra nada", async () => {
    const id = await solicitud(6, { haceDias: 8 });
    expect((await filas(`select * from cerrar_solicitudes_caducadas()`)).map((x) => x.IdSolicitud)).toContain(id);
    expect(await filas(`select "EstadoSolicitud" e, "IdUsuarioCreacion" u from "HistorialSolicitudes" where "IdSolicitud" = ${id}`)).toEqual([{ e: 7, u: null }]);
    expect(await filas(`select * from cerrar_solicitudes_caducadas()`)).toEqual([]);
  });

  it("no toca una solicitud que el Administrador re-aprobó (ya no está en 6)", async () => {
    const id = await solicitud(6, { haceDias: 8 });
    await db.exec(`select reaprobar_solicitud(${ADMIN}, ${id})`);
    await db.exec(`select * from cerrar_solicitudes_caducadas()`);
    expect(await estado(id)).toBe(2);
  });
});

describe("0049: participantes de una solicitud", () => {
  it("solicitante + quienes intervinieron en el historial + Administradores vigentes, sin duplicados ni inactivos", async () => {
    const id = await solicitud(1);
    await db.exec(`select aprobar_parcial_solicitud(${GESTOR}, ${id}, ${items(40, 50)}, 'x')`);
    const r = (await filas(`select "IdUsuario" i from participantes_solicitud(${id}) order by 1`)).map((x) => x.i);
    expect(r).toEqual([ADMIN, SOLICITANTE, GESTOR, ADMIN2]); // 1,2,3,4: el Administrador inactivo (5) no
    const correos = (await filas(`select "Correo" c from participantes_solicitud(${id})`)).map((x) => x.c);
    expect(new Set(correos).size).toBe(correos.length);
  });
});

describe("0049: suscripciones de los Administradores", () => {
  it("trae solo a los Administradores vigentes y puede excluir a uno", async () => {
    for (const [u, ep] of [[ADMIN, "a"], [ADMIN2, "b"], [GESTOR, "g"], [SOLICITANTE, "s"], [ADMIN_INACTIVO, "i"]] as const)
      await db.exec(`select guardar_suscripcion_push(${u}, 'https://push.x/adm-${ep}', 'k', 'a')`);
    const todos = (await filas(`select "Endpoint" e from suscripciones_push_administradores()`)).map((r) => r.e as string).filter((e) => e.includes("/adm-")).sort();
    expect(todos).toEqual(["https://push.x/adm-a", "https://push.x/adm-b"]);
    const sin = (await filas(`select "Endpoint" e from suscripciones_push_administradores(${ADMIN})`)).map((r) => r.e as string).filter((e) => e.includes("/adm-"));
    expect(sin).toEqual(["https://push.x/adm-b"]);
  });
});

describe("0049: permisos de ejecución", () => {
  it("el rol de la app ejecuta las funciones públicas; anon y authenticated ninguna; las internas no son invocables", async () => {
    const id = await solicitud(6);
    await db.exec("set role app_servidor");
    try {
      await db.query(`select * from participantes_solicitud(${id})`);
      await db.query(`select * from cerrar_solicitudes_caducadas()`);
      await db.query(`select * from suscripciones_push_administradores()`);
      await db.query(`select cerrar_solicitud(${ADMIN}, ${id}, 'ok')`);
      await expect(db.query(`select aplicar_aprobacion(${GESTOR}, ${id}, ${items(1, 1)})`)).rejects.toThrow(/permission denied/i);
    } finally { await db.exec("reset role"); }
    for (const r of ["anon", "authenticated"]) {
      await db.exec(`set role ${r}`);
      try { await expect(db.query(`select cerrar_solicitud(${ADMIN}, ${id}, 'x')`)).rejects.toThrow(/permission denied/i); } finally { await db.exec("reset role"); }
    }
  });
});
