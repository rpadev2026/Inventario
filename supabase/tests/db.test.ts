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
    insert into "Productos"("Codigo","Nombre","UnidadBase","Formato","StockMinimo","StockCritico") values
      ('HAR','Harina','G','BOLSA',10000,5000),('ACE','Aceite','ML','BOTELLA',4000,2000);
    insert into "Bodegas"("NombreBodega") values ('Cocina');
  `);
});

const FACT = (folio = 1, det = `'[{"producto":1,"unidad":"KG","precio":1000,"cantidad":50}]'`, neto = 42017, iva = 7983, total = 50000) =>
  `select registrar_factura(1,1,${folio},'2026-10-01','2026-10-02','CONTADO',${neto},${iva},${total},${det}::jsonb)`;

describe("registrar_factura", () => {
  it("crea factura, detalle, ingreso y stock en Bodega Central", async () => {
    await db.query(FACT(1));
    expect(Number(await val(`select count(*) from "ComprasDetalle"`))).toBe(1);
    expect(Number(await val(`select count(*) from "BodegaCentral"`))).toBe(1);
    expect(Number(await val(`select "Cantidad" from "StockBodega" sb join "Bodegas" b using("IdBodega") where b."EsCentral" and "IdProducto"=1`))).toBe(50000);
  });
  it("acumula stock en una segunda factura", async () => {
    await db.query(FACT(2));
    expect(Number(await val(`select "Cantidad" from "StockBodega" where "IdProducto"=1 and "IdBodega"=1`))).toBe(100000);
  });
  it("rechaza folio duplicado sin dejar datos a medias", async () => {
    const antes = Number(await val(`select count(*) from "BodegaCentral"`));
    await fails(FACT(1));
    expect(Number(await val(`select count(*) from "BodegaCentral"`))).toBe(antes);
  });
  it("rechaza detalle que no cuadra con el total (el precio ya incluye IVA)", async () => { await fails(FACT(3, undefined, 84034, 15966, 100000), /total/i); });
  it("rechaza un detalle tratado como neto: total = neto + IVA no cuadra con la suma", async () => { await fails(FACT(4, undefined, 50000, 9500, 59500), /total/i); });
  it("acepta una diferencia de $1 por redondeo", async () => {
    const id = Number(await val(`insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values ('DIF','Dif redondeo','G','CAJA') returning "IdProducto"`));
    await db.query(FACT(6, `'[{"producto":${id},"unidad":"KG","precio":1000,"cantidad":50}]'`, 42018, 7983, 50001));
  });
  it("rechaza producto inexistente y no deja la cabecera", async () => {
    await fails(FACT(5, `'[{"producto":999,"unidad":"KG","precio":1,"cantidad":1}]'`, 1, 0, 1), /Producto/);
    expect(Number(await val(`select count(*) from "Compras" where "Folio"=5`))).toBe(0);
  });
});

describe("flujo de solicitudes", () => {
  let sol: number;
  it("crea solicitud en estado Creada con historial", async () => {
    sol = Number(await val(`select crear_solicitud(2, 2, '[{"producto":1,"cantidad":30}]'::jsonb)`));
    expect(Number(await val(`select "EstadoSolicitud" from "Solicitudes" where "IdSolicitud"=${sol}`))).toBe(0);
    expect(Number(await val(`select count(*) from "HistorialSolicitudes" where "IdSolicitud"=${sol}`))).toBe(1);
  });
  it("no permite destino Bodega Central ni solicitud vacía", async () => {
    await fails(`select crear_solicitud(2, 1, '[{"producto":1,"cantidad":1}]'::jsonb)`, /Bodega destino/);
    await fails(`select crear_solicitud(2, 2, '[]'::jsonb)`, /productos/);
  });
  it("solo el dueño edita y solo en Creada", async () => {
    await fails(`select actualizar_solicitud(3, ${sol}, 2, '[{"producto":1,"cantidad":5}]'::jsonb)`, /solicitante/);
    await db.query(`select actualizar_solicitud(2, ${sol}, 2, '[{"producto":1,"cantidad":30},{"producto":2,"cantidad":10}]'::jsonb)`);
    expect(Number(await val(`select count(*) from "SolicitudesDetalle" where "IdSolicitud"=${sol}`))).toBe(2);
  });
  it("rechaza transiciones inválidas (Creada->Aprobada, recepcionar sin aprobar)", async () => {
    await fails(`select cambiar_estado_solicitud(3, ${sol}, 2::smallint)`, /Transición/);
    await fails(`select recepcionar_solicitud(2, ${sol}, '[{"producto":1,"cantidad":1}]'::jsonb)`, /recepcionable/);
  });
  it("no se puede enviar vacía y Creada->Enviada funciona", async () => {
    await db.query(`select cambiar_estado_solicitud(2, ${sol}, 1::smallint)`);
    expect(Number(await val(`select "EstadoSolicitud" from "Solicitudes" where "IdSolicitud"=${sol}`))).toBe(1);
  });
  it("aprobar valida stock y cantidades", async () => {
    await fails(`select aprobar_solicitud(3, ${sol}, '[{"producto":2,"cantidad":10}]'::jsonb)`, /Stock insuficiente/);
    await fails(`select aprobar_solicitud(3, ${sol}, '[{"producto":1,"cantidad":31}]'::jsonb)`, /inválida/);
    await fails(`select aprobar_solicitud(3, ${sol}, '[{"producto":1,"cantidad":0}]'::jsonb)`, /al menos un producto/);
  });
  it("aprueba con cantidad menor; ítems no informados quedan en 0", async () => {
    await db.query(`select aprobar_solicitud(3, ${sol}, '[{"producto":1,"cantidad":20}]'::jsonb)`);
    expect(Number(await val(`select "EstadoSolicitud" from "Solicitudes" where "IdSolicitud"=${sol}`))).toBe(2);
    expect(Number(await val(`select "CantidadAprobada" from "SolicitudesDetalle" where "IdSolicitud"=${sol} and "IdProducto"=2`))).toBe(0);
  });
  it("solo el solicitante recepciona y no más de lo pendiente", async () => {
    await fails(`select recepcionar_solicitud(3, ${sol}, '[{"producto":1,"cantidad":5}]'::jsonb)`, /solicitante/);
    await fails(`select recepcionar_solicitud(2, ${sol}, '[{"producto":1,"cantidad":21}]'::jsonb)`, /excede/);
  });
  it("recepción parcial -> estado 4, mueve stock y registra movimiento", async () => {
    const r = await val(`select recepcionar_solicitud(2, ${sol}, '[{"producto":1,"cantidad":8}]'::jsonb)`);
    expect(Number(r)).toBe(4);
    expect(Number(await val(`select "Cantidad" from "StockBodega" where "IdBodega"=1 and "IdProducto"=1`))).toBe(99992);
    expect(Number(await val(`select "Cantidad" from "StockBodega" where "IdBodega"=2 and "IdProducto"=1`))).toBe(8);
    expect(Number(await val(`select count(*) from "MovimientosBodega" where "IdSolicitud"=${sol}`))).toBe(1);
  });
  it("recepción final -> estado 3 y no se puede recepcionar otra vez", async () => {
    expect(Number(await val(`select recepcionar_solicitud(2, ${sol}, '[{"producto":1,"cantidad":12}]'::jsonb)`))).toBe(3);
    expect(Number(await val(`select "Cantidad" from "StockBodega" where "IdBodega"=2 and "IdProducto"=1`))).toBe(20);
    await fails(`select recepcionar_solicitud(2, ${sol}, '[{"producto":1,"cantidad":1}]'::jsonb)`, /recepcionable/);
    expect(Number(await val(`select count(*) from "HistorialSolicitudes" where "IdSolicitud"=${sol}`))).toBe(5);
  });
  it("rechazo desde Enviada y estado terminal", async () => {
    const s2 = Number(await val(`select crear_solicitud(2, 2, '[{"producto":1,"cantidad":1}]'::jsonb)`));
    await db.query(`select cambiar_estado_solicitud(2, ${s2}, 1::smallint)`);
    await db.query(`select cambiar_estado_solicitud(3, ${s2}, 5::smallint)`);
    await fails(`select cambiar_estado_solicitud(3, ${s2}, 2::smallint)`, /Transición/);
  });
});

describe("anular_factura", () => {
  it("revierte stock cuando está disponible", async () => {
    await db.query(`select registrar_factura(1,1,50,'2026-10-01','2026-10-02','CONTADO',840,160,1000,'[{"producto":2,"unidad":"L","precio":100,"cantidad":10}]'::jsonb)`);
    const id = Number(await val(`select "IdCompra" from "Compras" where "Folio"=50`));
    await fails(`select anular_factura(1, ${id}, 'x')`, /motivo/);
    await db.query(`select anular_factura(1, ${id}, 'Error de digitación')`);
    expect(Number(await val(`select "Cantidad" from "StockBodega" where "IdBodega"=1 and "IdProducto"=2`))).toBe(0);
    expect(Number(await val(`select "IdEstado" from "Compras" where "IdCompra"=${id}`))).toBe(0);
    await fails(`select anular_factura(1, ${id}, 'Otra vez anulada')`, /ya está anulada/);
  });
  it("no anula si el stock ya fue despachado y no deja cambios a medias", async () => {
    // folio 1 (50 HAR) + 2 (50 HAR) - 20 despachados => quedan 80; anular folio 1 (50) funciona, pero dejemos stock bajo
    const id = Number(await val(`select "IdCompra" from "Compras" where "Folio"=2`));
    await db.query(`update "StockBodega" set "Cantidad" = 10 where "IdBodega"=1 and "IdProducto"=1`);
    await fails(`select anular_factura(1, ${id}, 'Factura duplicada')`, /despachado/);
    expect(Number(await val(`select "IdEstado" from "Compras" where "IdCompra"=${id}`))).toBe(1);
    expect(Number(await val(`select "Cantidad" from "StockBodega" where "IdBodega"=1 and "IdProducto"=1`))).toBe(10);
  });
});

describe("maestros y reglas de factura", () => {
  const FP = (fr: string, fp: string, folio: number) =>
    `select registrar_factura(1,1,${folio},'2026-10-02','${fr}','${fp}',840,160,1000,'[{"producto":2,"unidad":"L","precio":100,"cantidad":10}]'::jsonb)`;
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
  it("rechaza producto con unidad base/formato inexistente", async () => {
    await fails(`insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values ('T1','T','Tonelada','CAJA')`, /foreign key|violates/i);
    await fails(`insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values ('T2','T','G','Tonelada')`, /foreign key|violates/i);
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
    await fails(`insert into "Productos"("Codigo","Nombre","UnidadBase","Formato","StockMinimo","StockCritico") values ('Z','Z','G','CAJA',1,5)`);
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
      ["compras.anular", "compras.registrar", "compras.ver", "productos.gestionar", "productos.ver", "proveedores.gestionar", "proveedores.ver", "recetas.gestionar", "recetas.ver"]);
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

describe("territorio en proveedores", () => {
  const prov = (cols: string, vals: string, rut: string) =>
    `insert into "Proveedores"("Rut","RazonSocial",${cols}) values ('${rut}','T',${vals})`;
  it("permite proveedor con solo región", async () => {
    await db.query(prov(`"Region"`, `'13'`, "T-1"));
  });
  it("rechaza comuna sin ciudad", async () => {
    await fails(prov(`"Comuna"`, `'13101'`, "T-2"), /requiere ciudad/);
  });
  it("rechaza ciudad sin región", async () => {
    await fails(prov(`"Ciudad"`, `'131'`, "T-2b"), /requiere región/);
  });
  it("rechaza ciudad que no pertenece a la región", async () => {
    await fails(prov(`"Region","Ciudad"`, `'05','131'`, "T-3"), /no pertenece a la región/);
  });
  it("rechaza comuna que no pertenece a la ciudad", async () => {
    await fails(prov(`"Region","Ciudad","Comuna"`, `'13','131','05101'`, "T-4"), /no pertenece a la ciudad/);
  });
  it("acepta combinación válida en proveedores y sucursales", async () => {
    await db.query(prov(`"Region","Ciudad","Comuna"`, `'13','131','13101'`, "T-5"));
    await db.query(`insert into "ProveedoresSucursales"("IdProveedor","Region","Ciudad","Comuna") values (1,'13','131','13101')`);
    await fails(`insert into "ProveedoresSucursales"("IdProveedor","Region","Comuna") values (1,'13','13101')`, /requiere ciudad/);
  });
  it("rechaza código inexistente por FK", async () => {
    await fails(prov(`"Region"`, `'77'`, "T-6"), /foreign key|violates/i);
  });
  it("convierte texto libre a códigos", async () => {
    const conv = async (r: string | null, c: string | null, m: string | null) => {
      const q = (v: string | null) => (v === null ? "null" : `'${v}'`);
      return (await db.query<any>(`select * from convertir_territorio_texto(${q(r)},${q(c)},${q(m)})`)).rows[0];
    };
    expect(await conv("ÑUBLE", null, null)).toEqual({ region: "16", ciudad: null, comuna: null });
    expect(await conv(null, null, "providencia")).toEqual({ region: "13", ciudad: "131", comuna: "13123" });
    expect(await conv("Valparaiso", "Valparaíso", null)).toEqual({ region: "05", ciudad: "051", comuna: null });
    expect(await conv("ñuble", null, null)).toEqual({ region: "16", ciudad: null, comuna: null });
    expect(await conv(null, null, "ñuñoa")).toEqual({ region: "13", ciudad: "131", comuna: "13120" });
    expect(await conv(null, null, "ÑUÑOA")).toEqual({ region: "13", ciudad: "131", comuna: "13120" });
    expect(await conv(null, null, "CONCEPCIÓN")).toEqual({ region: "08", ciudad: "081", comuna: "08101" });
    expect(await conv("VALPARAÍSO", "VALPARAÍSO", null)).toEqual({ region: "05", ciudad: "051", comuna: null });
    expect(await conv("xyz", "abc", "def")).toEqual({ region: null, ciudad: null, comuna: null });
  });
});

describe("vendedores: un RUT solo puede estar vigente en un proveedor", () => {
  let p2: number;
  const ins = (prov: number, rut: string, estado = 1) =>
    `insert into "ProveedoresVendedores"("IdProveedor","Rut","Nombres","Apellidos","IdEstado") values (${prov},'${rut}','N','A',${estado})`;
  it("prepara un segundo proveedor y el primer vendedor vigente", async () => {
    p2 = Number(await val(`insert into "Proveedores"("Rut","RazonSocial") values ('11111111-1','Prov Dos SA') returning "IdProveedor"`));
    await db.query(ins(1, "12345678-5"));
    expect(Number(await val(`select count(*) from "ProveedoresVendedores" where "Rut"='12345678-5'`))).toBe(1);
  });
  it("rechaza el mismo RUT vigente en otro proveedor", async () => {
    await fails(ins(p2, "12345678-5"), /un_vendedor_rut_vigente/);
  });
  it("permite el mismo RUT en otro proveedor si queda no vigente", async () => {
    await db.query(ins(p2, "12345678-5", 0));
    expect(Number(await val(`select count(*) from "ProveedoresVendedores" where "Rut"='12345678-5'`))).toBe(2);
  });
  it("rechaza reactivarlo mientras siga vigente en el otro proveedor", async () => {
    await fails(`update "ProveedoresVendedores" set "IdEstado"=1 where "IdProveedor"=${p2} and "Rut"='12345678-5'`, /un_vendedor_rut_vigente/);
  });
  it("al dejarlo no vigente en el primero, puede quedar vigente en el segundo, y ya no en el primero", async () => {
    await db.query(`update "ProveedoresVendedores" set "IdEstado"=0 where "IdProveedor"=1 and "Rut"='12345678-5'`);
    await db.query(`update "ProveedoresVendedores" set "IdEstado"=1 where "IdProveedor"=${p2} and "Rut"='12345678-5'`);
    await fails(`update "ProveedoresVendedores" set "IdEstado"=1 where "IdProveedor"=1 and "Rut"='12345678-5'`, /un_vendedor_rut_vigente/);
  });
  it("editar otros datos del vendedor vigente no se bloquea a sí mismo", async () => {
    await db.query(`update "ProveedoresVendedores" set "Nombres"='Editado' where "IdProveedor"=${p2} and "Rut"='12345678-5'`);
    expect(await val(`select "Nombres" from "ProveedoresVendedores" where "IdProveedor"=${p2} and "Rut"='12345678-5'`)).toBe("Editado");
  });
  it("dentro de un mismo proveedor el RUT no se repite (ni siquiera no vigente)", async () => {
    await fails(ins(p2, "12345678-5", 0), /duplicate|unique/i);
  });
  it("RUT distintos no interfieren", async () => {
    await db.query(ins(1, "87654321-4"));
    await db.query(ins(p2, "87654321-4", 0));
    expect(Number(await val(`select count(*) from "ProveedoresVendedores" where "Rut"='87654321-4' and "IdEstado"=1`))).toBe(1);
  });
});

describe("roles base inactivos (migración 0012)", () => {
  const idRol = async (n: string) => Number(await val(`select "IdRol" from "Roles" where "NombreRol"='${n}'`));
  const estado = async (id: number) => Number(await val(`select "IdEstado" from "Roles" where "IdRol"=${id}`));
  it("un rol base que ya está inactivo se puede guardar (permisos) sin error y se puede reactivar", async () => {
    const id = await idRol("Solicitante");
    await db.query(`update "Roles" set "IdEstado"=0 where "IdRol"=${id}`); // desactivación puntual hecha fuera de la aplicación
    await db.query(`select guardar_rol(1,${id},'Solicitante',null,0::smallint,array['bodegas.ver','solicitudes.ver_propias'])`);
    expect(await estado(id)).toBe(0);
    expect((await db.query<any>(`select "Permiso" from "RolesPermisos" where "IdRol"=${id} order by 1`)).rows.map((r) => r.Permiso)).toEqual(["bodegas.ver", "solicitudes.ver_propias"]);
    await db.query(`select guardar_rol(1,${id},'Solicitante',null,1::smallint,array['bodegas.ver','solicitudes.crear','solicitudes.ver_propias'])`);
    expect(await estado(id)).toBe(1);
  });
  it("sigue prohibido desactivar un rol base vigente y renombrar un rol base", async () => {
    const id = await idRol("Solicitante");
    await fails(`select guardar_rol(1,${id},'Solicitante',null,0::smallint,array[]::text[])`, /roles base/);
    await fails(`select guardar_rol(1,${id},'Otro nombre',null,1::smallint,array[]::text[])`, /roles base/);
    expect(await estado(id)).toBe(1);
  });
  it("un rol base inactivo tampoco se puede renombrar", async () => {
    const id = await idRol("Solicitante");
    await db.query(`update "Roles" set "IdEstado"=0 where "IdRol"=${id}`);
    await fails(`select guardar_rol(1,${id},'Otro nombre',null,0::smallint,array[]::text[])`, /roles base/);
    await db.query(`update "Roles" set "IdEstado"=1 where "IdRol"=${id}`);
  });
});

describe("precio desde la factura (migración 0016)", () => {
  const nuevo = async (nombre: string, base: string, extra = "") =>
    Number(await val(`insert into "Productos"("Nombre","UnidadBase","Formato"${extra ? ",\"Codigo\"" : ""}) values ('${nombre}','${base}','CAJA'${extra ? `,'${extra}'` : ""}) returning "IdProducto"`));
  type L = { producto: number; unidad: string; precio: number; cantidad: number };
  const fac = (folio: number, lineas: L[]) => {
    const total = Math.round(lineas.reduce((a, l) => a + Math.round(l.precio * l.cantidad * 100) / 100, 0));
    const neto = Math.round(total / 1.19);
    return `select registrar_factura(1,1,${folio},'2026-10-01','2026-10-02','CONTADO',${neto},${total - neto},${total},'${JSON.stringify(lineas)}'::jsonb)`;
  };
  const costo = async (id: number) => (await db.query<any>(`select "CostoUnitarioBase" c from "Productos" where "IdProducto"=${id}`)).rows[0].c;
  const hist = async (id: number) =>
    (await db.query<any>(`select "Origen" o, "Anulada" a, "CostoBaseAnterior" ant, "CostoBaseNuevo" n from "HistorialPreciosProducto" where "IdProducto"=${id} order by "IdHistorial"`)).rows;
  const stock = async (id: number) => Number(await val(`select coalesce(sum("Cantidad"),0) from "StockBodega" where "IdProducto"=${id} and "IdBodega"=1`));
  const idCompra = async (folio: number) => Number(await val(`select "IdCompra" from "Compras" where "Folio"=${folio}`));
  let p: number;

  it("producto sin compras tiene costo null y sin historial", async () => {
    p = await nuevo("Papa t1", "G");
    expect(await costo(p)).toBeNull();
    expect(await hist(p)).toEqual([]);
  });
  it("guarda la línea tal cual y suma el stock convertido a unidad base", async () => {
    await db.query(fac(1001, [{ producto: p, unidad: "KG", precio: 2000, cantidad: 5 }]));
    const d = (await db.query<any>(`select "Precio" pr, "UnidadMedida" u, "Cantidad" c from "ComprasDetalle" where "IdProducto"=${p}`)).rows;
    expect(d).toEqual([{ pr: "2000.00", u: "KG", c: "5.000" }]);
    expect(Number(await val(`select "Cantidad" from "BodegaCentral" where "IdProducto"=${p}`))).toBe(5000);
    expect(await stock(p)).toBe(5000);
  });
  it("calcula el costo con IVA por unidad base y registra el historial", async () => {
    expect(await costo(p)).toBe("2.000000");
    expect(await hist(p)).toEqual([{ o: "Compra", a: false, ant: null, n: "2.000000" }]);
    expect(Number(await val(`select "IdCompra" from "HistorialPreciosProducto" where "IdProducto"=${p}`))).toBe(await idCompra(1001));
  });
  it("no registra historial si el costo no cambia", async () => {
    await db.query(fac(1002, [{ producto: p, unidad: "G", precio: 2, cantidad: 100 }]));
    expect((await hist(p)).length).toBe(1);
    expect(await stock(p)).toBe(5100);
  });
  it("rige la última línea y suma el stock convertido de ambas", async () => {
    const q = await nuevo("Papa t4", "G");
    await db.query(fac(1003, [{ producto: q, unidad: "KG", precio: 3000, cantidad: 1 }, { producto: q, unidad: "G", precio: 4, cantidad: 500 }]));
    expect(await costo(q)).toBe("4.000000");
    expect((await hist(q)).map((h) => h.n)).toEqual(["3.000000", "4.000000"]);
    expect(await stock(q)).toBe(1500);
  });
  it("rechaza unidad incompatible, no vigente o inexistente sin dejar datos", async () => {
    const r = await nuevo("Papa t5", "G");
    const antes = [await val(`select count(*) from "Compras"`), await val(`select count(*) from "ComprasDetalle"`), await val(`select count(*) from "BodegaCentral"`)].map(Number);
    await fails(fac(1004, [{ producto: r, unidad: "L", precio: 1, cantidad: 1 }]), /no es compatible/);
    await fails(fac(1005, [{ producto: r, unidad: "NOPE", precio: 1, cantidad: 1 }]), /Unidad de medida/);
    await db.query(`update "UnidadesMedida" set "IdEstado"=0 where "Codigo"='KG'`);
    try { await fails(fac(1006, [{ producto: r, unidad: "KG", precio: 1, cantidad: 1 }]), /Unidad de medida/); }
    finally { await db.query(`update "UnidadesMedida" set "IdEstado"=1 where "Codigo"='KG'`); }
    const despues = [await val(`select count(*) from "Compras"`), await val(`select count(*) from "ComprasDetalle"`), await val(`select count(*) from "BodegaCentral"`)].map(Number);
    expect(despues).toEqual(antes);
  });
  it("rechaza una cantidad que convertida a unidad base queda en 0", async () => {
    const r = await nuevo("Papa t6", "G");
    await db.query(`insert into "UnidadesMedida"("Codigo","Nombre","UnidadBase","Factor") values ('MG_E','Miligramo E','G',0.001)`);
    await fails(fac(1007, [{ producto: r, unidad: "MG_E", precio: 1, cantidad: 0.0001 }]), /demasiado pequeña/);
    expect(Number(await val(`select count(*) from "Compras" where "Folio"=1007`))).toBe(0);
  });
  it("anular revierte el costo a la última línea no anulada (B anulada con C posterior igual no cambia nada)", async () => {
    const s = await nuevo("Papa t7", "G");
    await db.query(fac(1010, [{ producto: s, unidad: "KG", precio: 2000, cantidad: 1 }])); // A: 2
    await db.query(fac(1011, [{ producto: s, unidad: "KG", precio: 3000, cantidad: 1 }])); // B: 3
    await db.query(fac(1012, [{ producto: s, unidad: "KG", precio: 3000, cantidad: 1 }])); // C: 3 (sin cambio)
    expect(await costo(s)).toBe("3.000000");
    expect((await hist(s)).map((h) => h.n)).toEqual(["2.000000", "3.000000"]);
    expect(await stock(s)).toBe(3000);

    await db.query(`select anular_factura(1, ${await idCompra(1011)}, 'Error de digitación')`);
    expect(await costo(s)).toBe("3.000000"); // C rige
    expect(await stock(s)).toBe(2000);
    expect((await hist(s)).map((h) => [h.o, h.a])).toEqual([["Compra", false], ["Compra", true]]);

    await db.query(`select anular_factura(1, ${await idCompra(1012)}, 'Error de digitación')`);
    expect(await costo(s)).toBe("2.000000"); // vuelve a A
    expect((await hist(s)).slice(-1)).toEqual([{ o: "Anulación", a: false, ant: "3.000000", n: "2.000000" }]);

    await db.query(`select anular_factura(1, ${await idCompra(1010)}, 'Error de digitación')`);
    expect(await costo(s)).toBeNull(); // sin compras vigentes
    expect((await hist(s)).slice(-1)).toEqual([{ o: "Anulación", a: false, ant: "2.000000", n: null }]);
    expect(await stock(s)).toBe(0);
  });
  it("la unidad base debe ser base y no se edita con stock o facturas", async () => {
    await fails(`insert into "Productos"("Nombre","UnidadBase","Formato") values ('Mala base','KG','CAJA')`, /unidad base \(factor 1\)/);
    const t = await nuevo("Cambio base", "G");
    await db.query(`update "Productos" set "UnidadBase"='ML' where "IdProducto"=${t}`); // sin movimientos: se puede
    await fails(`update "Productos" set "UnidadBase"='ML' where "IdProducto"=${p}`, /ya tiene stock o facturas/);
  });
  it("no se puede cambiar el factor de una unidad usada por productos o facturas; sin uso sí", async () => {
    await fails(`update "UnidadesMedida" set "Factor"=500 where "Codigo"='KG'`, /hay productos, facturas o recetas que usan esta unidad/);
    await fails(`update "UnidadesMedida" set "Factor"=2 where "Codigo"='G'`);
    await db.query(`insert into "UnidadesMedida"("Codigo","Nombre","UnidadBase","Factor") values ('CAJ12','Caja 12','UN',12)`);
    await db.query(`update "UnidadesMedida" set "Factor"=24 where "Codigo"='CAJ12'`);
    expect(Number(await val(`select "Factor" from "UnidadesMedida" where "Codigo"='CAJ12'`))).toBe(24);
  });
  it("no se puede desactivar una unidad que es base de productos o unidades vigentes", async () => {
    await fails(`update "UnidadesMedida" set "IdEstado"=0 where "Codigo"='G'`, /productos o unidades vigentes que usan esta unidad como base/);
    // una unidad sin uso sí se desactiva; Kilo no es base de nada
    await db.query(`insert into "UnidadesMedida"("Codigo","Nombre","UnidadBase","Factor") values ('XB_E','Base sin uso','XB_E',1)`);
    await db.query(`update "UnidadesMedida" set "IdEstado"=0 where "Codigo"='XB_E'`);
    await db.query(`update "UnidadesMedida" set "IdEstado"=0 where "Codigo"='KG'`);
    await db.query(`update "UnidadesMedida" set "IdEstado"=1 where "Codigo"='KG'`);
  });
  it("Codigo es opcional pero único; Nombre es único", async () => {
    await nuevo("Sin codigo A", "G");
    await nuevo("Sin codigo B", "G");
    await db.query(`insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values ('UNI','Con codigo','G','CAJA')`);
    await fails(`insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values ('UNI','Otro','G','CAJA')`, /Productos_Codigo_key/);
    await fails(`insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values ('OTRO','Con codigo','G','CAJA')`, /Productos_Nombre_key/);
  });
  it("las RPC rechazan producto inexistente, no vigente o no numérico con el producto reconocible", async () => {
    await db.query(`insert into "Productos"("Codigo","Nombre","UnidadBase","Formato","IdEstado") values ('OFF','Inactivo','G','CAJA',0)`);
    const off = Number(await val(`select "IdProducto" from "Productos" where "Codigo"='OFF'`));
    const sinCodigo = Number(await val(`select "IdProducto" from "Productos" where "Nombre"='SIN CODIGO A'`));
    await db.query(`update "Productos" set "IdEstado"=0 where "IdProducto"=${sinCodigo}`);
    await fails(`select crear_solicitud(2, 2, '[{"producto":${off},"cantidad":1}]'::jsonb)`, /Producto OFF — INACTIVO no existe o no vigente/);
    await fails(`select crear_solicitud(2, 2, '[{"producto":${sinCodigo},"cantidad":1}]'::jsonb)`, /Producto SIN CODIGO A no existe o no vigente/);
    await fails(`select crear_solicitud(2, 2, '[{"producto":999999,"cantidad":1}]'::jsonb)`, /Producto 999999 no existe o no vigente/);
    await fails(`select crear_solicitud(2, 2, '[{"producto":"abc","cantidad":1}]'::jsonb)`, /Producto no válido/);
    await fails(fac(1020, [{ producto: off, unidad: "KG", precio: 1, cantidad: 1 }]), /Producto OFF — INACTIVO/);
    expect(Number(await val(`select count(*) from "Compras" where "Folio"=1020`))).toBe(0);
  });
  it("el historial no es accesible para anon/authenticated", async () => {
    for (const rol of ["anon", "authenticated"]) {
      await db.exec(`set role ${rol}`);
      await fails(`select * from "HistorialPreciosProducto"`, /permission denied/);
      await db.exec("reset role");
    }
  });
});

describe("código y nombre de producto en mayúscula (migración 0018)", () => {
  const ins = (cod: string | null, nom: string) =>
    `insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values (${cod === null ? "null" : `'${cod}'`},'${nom}','G','CAJA') returning "IdProducto"`;
  const fila = async (id: number) => (await db.query<any>(`select "Codigo" c, "Nombre" n from "Productos" where "IdProducto"=${id}`)).rows[0];
  let id: number;
  it("al crear guarda código y nombre en mayúscula", async () => {
    id = Number(await val(ins("p-min", "papas fritas")));
    expect(await fila(id)).toEqual({ c: "P-MIN", n: "PAPAS FRITAS" });
  });
  it("al editar también", async () => {
    await db.query(`update "Productos" set "Codigo"='q-1', "Nombre"='papas nuevas' where "IdProducto"=${id}`);
    expect(await fila(id)).toEqual({ c: "Q-1", n: "PAPAS NUEVAS" });
  });
  it("quita espacios en los extremos y un código vacío queda null", async () => {
    const a = Number(await val(ins("   ", "  sal fina  ")));
    expect(await fila(a)).toEqual({ c: null, n: "SAL FINA" });
  });
  it("conserva los acentos y la ñ en mayúscula", async () => {
    const a = Number(await val(ins(null, "piña en almíbar")));
    expect((await fila(a)).n).toBe("PIÑA EN ALMÍBAR");
  });
  it("código y nombre que solo difieren en mayúsculas son duplicados", async () => {
    await fails(ins("q-1", "otro nombre"), /Productos_Codigo_key/);
    await fails(ins("otro-cod", "Papas Nuevas"), /Productos_Nombre_key/);
  });
});
