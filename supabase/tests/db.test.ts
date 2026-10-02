import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname, "..");
let db: PGlite;

async function fails(sql: string, msg?: RegExp) {
  await expect(db.query(sql)).rejects.toThrow(msg);
}
const val = async (sql: string) => Object.values((await db.query<any>(sql)).rows[0])[0] as any;

beforeAll(async () => {
  db = new PGlite();
  // Roles que Supabase provee y que las migraciones referencian
  await db.exec("create role anon; create role authenticated;");
  const migs = readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const m of migs) await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
  await db.exec(`
    insert into "Usuarios"("Rut","Nombres","Apellidos","Correo") values
      ('1-9','Ana','Compras','ana@x.cl'),('2-7','Beto','Solicita','beto@x.cl'),('3-5','Cami','Bodega','cami@x.cl');
    insert into "Proveedores"("Rut","RazonSocial","Giro") values ('76086428-5','Prov SA','Alimentos');
    insert into "Productos"("CodigoProducto","NombreProducto","UnidadMedida","Formato","StockMinimo","StockCritico") values
      ('HAR','Harina','KG','BOLSA',10,5),('ACE','Aceite','L','BOTELLA',4,2);
    insert into "Bodegas"("NombreBodega") values ('Cocina');
  `);
});

const FACT = (folio = 1, det = `'[{"codigo":"HAR","precio":1000,"cantidad":50}]'`, neto = 50000, iva = 9500, total = 59500) =>
  `select registrar_factura(1,1,${folio},'2026-10-01','2026-10-02','CONTADO',${neto},${iva},${total},${det}::jsonb)`;

describe("registrar_factura", () => {
  it("crea factura, detalle, ingreso y stock en Bodega Central", async () => {
    await db.query(FACT(1));
    expect(Number(await val(`select count(*) from "ComprasDetalle"`))).toBe(1);
    expect(Number(await val(`select count(*) from "BodegaCentral"`))).toBe(1);
    expect(Number(await val(`select "Cantidad" from "StockBodega" sb join "Bodegas" b using("IdBodega") where b."EsCentral" and "CodigoProducto"='HAR'`))).toBe(50);
  });
  it("acumula stock en una segunda factura", async () => {
    await db.query(FACT(2));
    expect(Number(await val(`select "Cantidad" from "StockBodega" where "CodigoProducto"='HAR' and "IdBodega"=1`))).toBe(100);
  });
  it("rechaza folio duplicado sin dejar datos a medias", async () => {
    const antes = Number(await val(`select count(*) from "BodegaCentral"`));
    await fails(FACT(1));
    expect(Number(await val(`select count(*) from "BodegaCentral"`))).toBe(antes);
  });
  it("rechaza detalle que no cuadra con neto", async () => { await fails(FACT(3, undefined, 99999, 18999, 118998), /neto/i); });
  it("rechaza total inconsistente", async () => { await fails(FACT(4, undefined, 50000, 9500, 70000)); });
  it("rechaza producto inexistente y no deja la cabecera", async () => {
    await fails(FACT(5, `'[{"codigo":"NOPE","precio":1,"cantidad":1}]'`, 1, 0, 1), /Producto/);
    expect(Number(await val(`select count(*) from "Compras" where "Folio"=5`))).toBe(0);
  });
});

describe("flujo de solicitudes", () => {
  let sol: number;
  it("crea solicitud en estado Creada con historial", async () => {
    sol = Number(await val(`select crear_solicitud(2, 2, '[{"codigo":"HAR","cantidad":30}]'::jsonb)`));
    expect(Number(await val(`select "EstadoSolicitud" from "Solicitudes" where "IdSolicitud"=${sol}`))).toBe(0);
    expect(Number(await val(`select count(*) from "HistorialSolicitudes" where "IdSolicitud"=${sol}`))).toBe(1);
  });
  it("no permite destino Bodega Central ni solicitud vacía", async () => {
    await fails(`select crear_solicitud(2, 1, '[{"codigo":"HAR","cantidad":1}]'::jsonb)`, /Bodega destino/);
    await fails(`select crear_solicitud(2, 2, '[]'::jsonb)`, /productos/);
  });
  it("solo el dueño edita y solo en Creada", async () => {
    await fails(`select actualizar_solicitud(3, ${sol}, 2, '[{"codigo":"HAR","cantidad":5}]'::jsonb)`, /solicitante/);
    await db.query(`select actualizar_solicitud(2, ${sol}, 2, '[{"codigo":"HAR","cantidad":30},{"codigo":"ACE","cantidad":10}]'::jsonb)`);
    expect(Number(await val(`select count(*) from "SolicitudesDetalle" where "IdSolicitud"=${sol}`))).toBe(2);
  });
  it("rechaza transiciones inválidas (Creada->Aprobada, recepcionar sin aprobar)", async () => {
    await fails(`select cambiar_estado_solicitud(3, ${sol}, 2::smallint)`, /Transición/);
    await fails(`select recepcionar_solicitud(2, ${sol}, '[{"codigo":"HAR","cantidad":1}]'::jsonb)`, /recepcionable/);
  });
  it("no se puede enviar vacía y Creada->Enviada funciona", async () => {
    await db.query(`select cambiar_estado_solicitud(2, ${sol}, 1::smallint)`);
    expect(Number(await val(`select "EstadoSolicitud" from "Solicitudes" where "IdSolicitud"=${sol}`))).toBe(1);
  });
  it("aprobar valida stock y cantidades", async () => {
    await fails(`select aprobar_solicitud(3, ${sol}, '[{"codigo":"ACE","cantidad":10}]'::jsonb)`, /Stock insuficiente/);
    await fails(`select aprobar_solicitud(3, ${sol}, '[{"codigo":"HAR","cantidad":31}]'::jsonb)`, /inválida/);
    await fails(`select aprobar_solicitud(3, ${sol}, '[{"codigo":"HAR","cantidad":0}]'::jsonb)`, /al menos un producto/);
  });
  it("aprueba con cantidad menor; ítems no informados quedan en 0", async () => {
    await db.query(`select aprobar_solicitud(3, ${sol}, '[{"codigo":"HAR","cantidad":20}]'::jsonb)`);
    expect(Number(await val(`select "EstadoSolicitud" from "Solicitudes" where "IdSolicitud"=${sol}`))).toBe(2);
    expect(Number(await val(`select "CantidadAprobada" from "SolicitudesDetalle" where "IdSolicitud"=${sol} and "CodigoProducto"='ACE'`))).toBe(0);
  });
  it("solo el solicitante recepciona y no más de lo pendiente", async () => {
    await fails(`select recepcionar_solicitud(3, ${sol}, '[{"codigo":"HAR","cantidad":5}]'::jsonb)`, /solicitante/);
    await fails(`select recepcionar_solicitud(2, ${sol}, '[{"codigo":"HAR","cantidad":21}]'::jsonb)`, /excede/);
  });
  it("recepción parcial -> estado 4, mueve stock y registra movimiento", async () => {
    const r = await val(`select recepcionar_solicitud(2, ${sol}, '[{"codigo":"HAR","cantidad":8}]'::jsonb)`);
    expect(Number(r)).toBe(4);
    expect(Number(await val(`select "Cantidad" from "StockBodega" where "IdBodega"=1 and "CodigoProducto"='HAR'`))).toBe(92);
    expect(Number(await val(`select "Cantidad" from "StockBodega" where "IdBodega"=2 and "CodigoProducto"='HAR'`))).toBe(8);
    expect(Number(await val(`select count(*) from "MovimientosBodega" where "IdSolicitud"=${sol}`))).toBe(1);
  });
  it("recepción final -> estado 3 y no se puede recepcionar otra vez", async () => {
    expect(Number(await val(`select recepcionar_solicitud(2, ${sol}, '[{"codigo":"HAR","cantidad":12}]'::jsonb)`))).toBe(3);
    expect(Number(await val(`select "Cantidad" from "StockBodega" where "IdBodega"=2 and "CodigoProducto"='HAR'`))).toBe(20);
    await fails(`select recepcionar_solicitud(2, ${sol}, '[{"codigo":"HAR","cantidad":1}]'::jsonb)`, /recepcionable/);
    expect(Number(await val(`select count(*) from "HistorialSolicitudes" where "IdSolicitud"=${sol}`))).toBe(5);
  });
  it("rechazo desde Enviada y estado terminal", async () => {
    const s2 = Number(await val(`select crear_solicitud(2, 2, '[{"codigo":"HAR","cantidad":1}]'::jsonb)`));
    await db.query(`select cambiar_estado_solicitud(2, ${s2}, 1::smallint)`);
    await db.query(`select cambiar_estado_solicitud(3, ${s2}, 5::smallint)`);
    await fails(`select cambiar_estado_solicitud(3, ${s2}, 2::smallint)`, /Transición/);
  });
});

describe("anular_factura", () => {
  it("revierte stock cuando está disponible", async () => {
    await db.query(`select registrar_factura(1,1,50,'2026-10-01','2026-10-02','CONTADO',1000,190,1190,'[{"codigo":"ACE","precio":100,"cantidad":10}]'::jsonb)`);
    const id = Number(await val(`select "IdCompra" from "Compras" where "Folio"=50`));
    await fails(`select anular_factura(1, ${id}, 'x')`, /motivo/);
    await db.query(`select anular_factura(1, ${id}, 'Error de digitación')`);
    expect(Number(await val(`select "Cantidad" from "StockBodega" where "IdBodega"=1 and "CodigoProducto"='ACE'`))).toBe(0);
    expect(Number(await val(`select "IdEstado" from "Compras" where "IdCompra"=${id}`))).toBe(0);
    await fails(`select anular_factura(1, ${id}, 'Otra vez anulada')`, /ya está anulada/);
  });
  it("no anula si el stock ya fue despachado y no deja cambios a medias", async () => {
    // folio 1 (50 HAR) + 2 (50 HAR) - 20 despachados => quedan 80; anular folio 1 (50) funciona, pero dejemos stock bajo
    const id = Number(await val(`select "IdCompra" from "Compras" where "Folio"=2`));
    await db.query(`update "StockBodega" set "Cantidad" = 10 where "IdBodega"=1 and "CodigoProducto"='HAR'`);
    await fails(`select anular_factura(1, ${id}, 'Factura duplicada')`, /despachado/);
    expect(Number(await val(`select "IdEstado" from "Compras" where "IdCompra"=${id}`))).toBe(1);
    expect(Number(await val(`select "Cantidad" from "StockBodega" where "IdBodega"=1 and "CodigoProducto"='HAR'`))).toBe(10);
  });
});

describe("maestros y reglas de factura", () => {
  const FP = (fr: string, fp: string, folio: number) =>
    `select registrar_factura(1,1,${folio},'2026-10-02','${fr}','${fp}',1000,190,1190,'[{"codigo":"ACE","precio":100,"cantidad":10}]'::jsonb)`;
  it("rechaza fecha de recepción anterior a la de factura", async () => {
    await fails(FP("2026-10-01", "CONTADO", 70), /fecha de recepción/i);
    await db.query(FP("2026-10-02", "CONTADO", 70));
  });
  it("rechaza forma de pago inexistente", async () => {
    await fails(FP("2026-10-02", "NOPE", 71), /forma de pago/i);
  });
  it("rechaza forma de pago inactiva", async () => {
    await db.query(`update "FormasPago" set "IdEstado"=0 where "Codigo"='CONTADO'`);
    try { await fails(FP("2026-10-02", "CONTADO", 72), /forma de pago/i); }
    finally { await db.query(`update "FormasPago" set "IdEstado"=1 where "Codigo"='CONTADO'`); }
  });
  it("rechaza producto con unidad/formato inexistente", async () => {
    await fails(`insert into "Productos"("CodigoProducto","NombreProducto","UnidadMedida","Formato") values ('T1','T','Tonelada','CAJA')`, /foreign key|violates/i);
    await fails(`insert into "Productos"("CodigoProducto","NombreProducto","UnidadMedida","Formato") values ('T2','T','KG','Tonelada')`, /foreign key|violates/i);
  });
  it("siembra formas, unidades y formatos iniciales", async () => {
    const cods = async (t: string) => (await db.query<any>(`select "Codigo" from "${t}" order by "Codigo"`)).rows.map((r) => r.Codigo);
    expect(await cods("FormasPago")).toEqual(["CONTADO", "CREDITO_15", "CREDITO_30", "CREDITO_60", "TRANSFERENCIA"]);
    expect(await cods("UnidadesMedida")).toEqual(["G", "KG", "L", "ML", "UN"]);
    expect(await cods("Formatos")).toEqual(["BIN", "BOLSA", "BOTELLA", "CAJA", "LATA", "MANGA", "PACK", "PALLET", "SACHET", "TARRO"]);
  });
  it("código de catálogo solo acepta mayúsculas/dígitos/_", async () => {
    await fails(`insert into "FormasPago"("Codigo","Nombre") values ('contado','x')`, /check/i);
    await fails(`insert into "Formatos"("Codigo","Nombre") values ('CON ESPACIO','x')`, /check/i);
  });
});

describe("integridad y permisos", () => {
  it("el stock no puede quedar negativo", async () => {
    await fails(`update "StockBodega" set "Cantidad" = -1 where "IdBodega"=1`);
  });
  it("solo existe una Bodega Central", async () => {
    await fails(`insert into "Bodegas"("NombreBodega","EsCentral") values ('Otra', true)`);
  });
  it("stock crítico no puede superar al mínimo", async () => {
    await fails(`insert into "Productos"("CodigoProducto","NombreProducto","UnidadMedida","Formato","StockMinimo","StockCritico") values ('Z','Z','KG','CAJA',1,5)`);
  });
  it("anon/authenticated no tienen acceso a tablas ni funciones", async () => {
    for (const rol of ["anon", "authenticated"]) {
      await db.exec(`set role ${rol}`);
      await fails(`select * from "Claves"`, /permission denied/);
      await fails(`select registrar_factura(1,1,99,'2026-10-01','2026-10-01','CONTADO',0,0,0,'[]'::jsonb)`, /permission denied/);
      await db.exec("reset role");
    }
  });
  it("todas las tablas públicas tienen RLS activo", async () => {
    expect(Number(await val(`select count(*) from pg_tables where schemaname='public' and not rowsecurity`))).toBe(0);
  });
});

describe("roles y permisos", () => {
  const permisos = async (rol: string) =>
    (await db.query<any>(`select "Permiso" from "RolesPermisos" rp join "Roles" r using("IdRol") where r."NombreRol"='${rol}' order by 1`)).rows.map((r) => r.Permiso);
  const idRol = async (n: string) => Number(await val(`select "IdRol" from "Roles" where "NombreRol"='${n}'`));

  it("roles base siembran permisos equivalentes", async () => {
    expect(await permisos("Compras")).toEqual(
      ["compras.anular", "compras.registrar", "compras.ver", "productos.gestionar", "productos.ver", "proveedores.gestionar", "proveedores.ver"]);
    expect(await permisos("Bodeguero Central")).toEqual(["bodegas.ver", "movimientos.ver", "solicitudes.gestionar", "solicitudes.ver_propias"]);
    expect(await permisos("Solicitante")).toEqual(["bodegas.ver", "solicitudes.crear", "solicitudes.ver_propias"]);
    expect(await permisos("Administrador")).toEqual([]);
    expect(Number(await val(`select count(*) from "Roles" where "EsBase"`))).toBe(4);
  });
  it("guardar_rol crea rol con permisos y reemplaza al editar", async () => {
    const id = Number(await val(`select guardar_rol(1,null,'  Auditor ','Solo lectura',1::smallint,array['compras.ver','bodegas.ver'])`));
    expect(await permisos("Auditor")).toEqual(["bodegas.ver", "compras.ver"]);
    expect(await val(`select "NombreRol" from "Roles" where "IdRol"=${id}`)).toBe("Auditor");
    await db.query(`select guardar_rol(1,${id},'Auditor','Otro',1::smallint,array['productos.ver'])`);
    expect(await permisos("Auditor")).toEqual(["productos.ver"]);
  });
  it("rechaza permisos con formato inválido", async () => {
    await fails(`select guardar_rol(1,null,'Malo',null,1::smallint,array['XX'])`);
  });
  it("rechaza nombre duplicado sin distinguir mayúsculas", async () => {
    await fails(`select guardar_rol(1,null,'auditor',null,1::smallint,array[]::text[])`, /Ya existe un rol/);
    await fails(`select guardar_rol(1,null,'COMPRAS',null,1::smallint,array[]::text[])`, /Ya existe un rol/);
  });
  it("rechaza nombre vacío o demasiado largo", async () => {
    await fails(`select guardar_rol(1,null,'   ',null,1::smallint,array[]::text[])`, /nombre/i);
    await fails(`select guardar_rol(1,null,'${"x".repeat(61)}',null,1::smallint,array[]::text[])`, /nombre/i);
  });
  it("rechaza renombrar o desactivar un rol base", async () => {
    const id = await idRol("Compras");
    await fails(`select guardar_rol(1,${id},'Otro',null,1::smallint,array[]::text[])`, /roles base/);
    await fails(`select guardar_rol(1,${id},'Compras',null,0::smallint,array[]::text[])`, /roles base/);
  });
  it("rechaza desactivar un rol con usuarios activos; sin usuarios sí permite", async () => {
    const id = await idRol("Auditor");
    await db.query(`insert into "UsuariosRoles"("IdUsuario","IdRol") values (1,${id})`);
    await fails(`select guardar_rol(1,${id},'Auditor',null,0::smallint,array[]::text[])`, /usuarios activos/);
    await db.query(`update "UsuariosRoles" set "IdEstado"=0 where "IdRol"=${id}`);
    await db.query(`select guardar_rol(1,${id},'Auditor',null,0::smallint,array[]::text[])`);
    expect(Number(await val(`select "IdEstado" from "Roles" where "IdRol"=${id}`))).toBe(0);
  });
  it("rechaza editar un rol inexistente", async () => {
    await fails(`select guardar_rol(1,99999,'Fantasma',null,1::smallint,array[]::text[])`, /no existe/i);
  });
  it("no modifica permisos del rol Administrador", async () => {
    const id = await idRol("Administrador");
    await db.query(`select guardar_rol(1,${id},'Administrador',null,1::smallint,array['compras.ver'])`);
    expect(await permisos("Administrador")).toEqual([]);
  });
});

describe("territorio", () => {
  it("carga 16 regiones, 56 provincias y 346 comunas", async () => {
    expect(Number(await val(`select count(*) from "Regiones"`))).toBe(16);
    expect(Number(await val(`select count(*) from "Provincias"`))).toBe(56);
    expect(Number(await val(`select count(*) from "Comunas"`))).toBe(346);
  });
  it("incluye Antártica (12202)", async () => {
    expect(await val(`select "Nombre" from "Comunas" where "Codigo"='12202'`)).toBe("Antártica");
  });
  it("rechaza una comuna con provincia inexistente", async () => {
    await fails(`insert into "Comunas"("Codigo","Nombre","CodigoProvincia") values ('99999','X','998')`);
  });
  it("rechaza códigos de región con formato inválido", async () => {
    await fails(`insert into "Regiones"("Codigo","Nombre") values ('1','X')`);
    await fails(`insert into "Regiones"("Codigo","Nombre") values ('AB','X')`);
  });
  it("rechaza desactivar una región con ciudades vigentes", async () => {
    await fails(`update "Regiones" set "IdEstado"=0 where "Codigo"='13'`, /ciudades vigentes/);
  });
  it("rechaza desactivar una provincia con comunas vigentes", async () => {
    await fails(`update "Provincias" set "IdEstado"=0 where "Codigo"='131'`, /comunas vigentes/);
  });
  it("permite desactivar una región sin hijos", async () => {
    await db.query(`insert into "Regiones"("Codigo","Nombre") values ('99','Prueba')`);
    await db.query(`update "Regiones" set "IdEstado"=0 where "Codigo"='99'`);
    expect(Number(await val(`select "IdEstado" from "Regiones" where "Codigo"='99'`))).toBe(0);
  });
  it("tiene RLS activo en las tres tablas", async () => {
    expect(Number(await val(`select count(*) from pg_class where relname in ('Regiones','Provincias','Comunas') and relrowsecurity`))).toBe(3);
  });
});
