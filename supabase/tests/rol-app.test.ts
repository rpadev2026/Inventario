import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Rol de base de datos propio de la aplicación (`app_servidor`, migración 0030): privilegios mínimos en lugar de service_role.
 * La matriz de abajo es la ÚNICA lista de lo que la app puede hacer directamente sobre cada tabla (lo demás, solo por funciones SQL).
 * Una tabla nueva obliga a decidir aquí cuánto acceso tiene.
 */
const SOLO_LEER = [
  "Compras", "ComprasDetalle", "HistorialClaves", "HistorialPreciosProducto", "HistorialSolicitudes", "MovimientosBodega", "Permisos",
  "RecetaDetalles", "Recetas", "Roles", "RolesPermisos", "Solicitudes", "SolicitudesDetalle", "StockBodega", "BodegaCentral",
];
const LEER_INSERTAR_ACTUALIZAR = [
  "Bodegas", "Proveedores", "ProveedoresSucursales", "ProveedoresVendedores", "Productos", "UsuariosRoles",
  "FormasPago", "UnidadesMedida", "Formatos", "Regiones", "Provincias", "Comunas",
];
const SOLO_INSERTAR = ["CorreosPendientes"]; // la app encola; la cola se lee y resuelve por funciones
const COLUMNAS = { Usuarios: ["Nombres", "Apellidos", "Correo", "IdEstado", "IdUsuarioModificacion"], Claves: ["IntentosFallidos", "BloqueadoHasta"] };
const SIN_ACCESO = ["IntentosLogin"]; // solo por funciones

const dir = join(__dirname, "..");
let db: PGlite;
const filas = async (sql: string) => (await db.query<any>(sql)).rows;
const como = async (sql: string) => { await db.exec("set role app_servidor"); try { return await db.query(sql); } finally { await db.exec("reset role"); } };
const permitido = async (sql: string) => { await expect(como(sql)).resolves.toBeDefined(); };
const denegado = async (sql: string) => { await expect(como(sql)).rejects.toThrow(/permission denied|row-level security/i); };

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role authenticator noinherit;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
  await db.exec(`
    insert into "Usuarios"("Rut","Nombres","Apellidos","Correo") values ('1-9','Ana','Admin','ana@x.cl');
    insert into "Claves"("IdUsuario","Password") values (1,'hash');
    insert into "Bodegas"("NombreBodega") values ('COCINA');
    insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values ('P1','HARINA','G','BOLSA');
  `);
});

describe("rol app_servidor: la matriz coincide con los privilegios reales", () => {
  it("el rol existe, no puede iniciar sesión ni se salta RLS (cada tabla tiene su política)", async () => {
    expect((await filas(`select rolcanlogin, rolsuper, rolbypassrls from pg_roles where rolname = 'app_servidor'`))[0]).toEqual({ rolcanlogin: false, rolsuper: false, rolbypassrls: false });
    expect((await filas(`select pg_has_role('authenticator', 'app_servidor', 'member') as m`))[0].m).toBe(true); // así PostgREST puede asumirlo
  });

  it("cada tabla de public está clasificada y tiene exactamente los privilegios de la matriz", async () => {
    const tablas = (await filas(`select tablename t from pg_tables where schemaname = 'public'`)).map((r) => r.t as string);
    const conocidas = new Set([...SOLO_LEER, ...LEER_INSERTAR_ACTUALIZAR, ...SOLO_INSERTAR, ...Object.keys(COLUMNAS), ...SIN_ACCESO]);
    expect(tablas.filter((t) => !conocidas.has(t)), "tablas sin clasificar en la matriz").toEqual([]);
    for (const t of tablas) {
      const p = async (priv: string) => (await filas(`select has_table_privilege('app_servidor', '"${t}"', '${priv}') as ok`))[0].ok as boolean;
      const esperado = {
        select: [...SOLO_LEER, ...LEER_INSERTAR_ACTUALIZAR, ...Object.keys(COLUMNAS)].includes(t),
        insert: [...LEER_INSERTAR_ACTUALIZAR, ...SOLO_INSERTAR].includes(t),
        update: LEER_INSERTAR_ACTUALIZAR.includes(t), // las de columnas no tienen UPDATE de tabla completa
        delete: false, truncate: false, references: false, trigger: false,
      };
      for (const [priv, ok] of Object.entries(esperado)) expect(await p(priv), `${t}: ${priv}`).toBe(ok);
    }
  });

  it("los privilegios por columna son solo los de la matriz", async () => {
    for (const [t, cols] of Object.entries(COLUMNAS)) {
      const reales = (await filas(`select attname a from pg_attribute where attrelid = '"${t}"'::regclass and attnum > 0 and not attisdropped
        and has_column_privilege('app_servidor', '"${t}"', attname, 'update') order by attname`)).map((r) => r.a);
      expect(reales, t).toEqual([...cols].sort());
    }
  });
});

describe("rol app_servidor: lo que la aplicación hace, funciona", () => {
  it("ve las filas (la política de RLS lo permite) y no solo no falla", async () => {
    for (const t of ["Productos", "Usuarios"]) {
      const r = (await como(`select count(*)::int n from "${t}"`)) as { rows: { n: number }[] };
      expect(r.rows[0].n, t).toBeGreaterThanOrEqual(1);
    }
  });
  it("lee todas las tablas que lee", async () => {
    for (const t of [...SOLO_LEER, ...LEER_INSERTAR_ACTUALIZAR, ...Object.keys(COLUMNAS)]) await permitido(`select count(*) from "${t}"`);
  });
  it("crea y edita lo que crea y edita (con sus triggers de reglas)", async () => {
    await permitido(`insert into "Bodegas"("NombreBodega") values ('bar')`);
    await permitido(`update "Bodegas" set "NombreBodega" = 'COCINA 2' where "NombreBodega" = 'COCINA'`);
    await permitido(`insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values ('P2','aceite','ML','BOTELLA')`);
    await permitido(`update "Productos" set "Nombre" = 'HARINA 0' where "Codigo" = 'P1'`);
    await permitido(`insert into "Proveedores"("Rut","RazonSocial") values ('76086428-5','prov sa')`);
    await permitido(`update "Proveedores" set "Giro" = 'x' where "Rut" = '76086428-5'`);
    await permitido(`insert into "ProveedoresSucursales"("IdProveedor","Direccion") select "IdProveedor",'calle 1' from "Proveedores"`);
    await permitido(`insert into "ProveedoresVendedores"("IdProveedor","Rut","Nombres","Apellidos") select "IdProveedor",'2-7','a','b' from "Proveedores"`);
    await permitido(`insert into "FormasPago"("Codigo","Nombre") values ('TARJ','tarjeta')`);
    await permitido(`update "FormasPago" set "Nombre" = 'TARJETA' where "Codigo" = 'TARJ'`);
    await permitido(`insert into "UsuariosRoles"("IdUsuario","IdRol") select 1, "IdRol" from "Roles" where "NombreRol" = 'Compras'`);
    await permitido(`update "UsuariosRoles" set "IdEstado" = 0 where "IdUsuario" = 1`);
    await permitido(`update "Usuarios" set "Nombres" = 'ANA 2', "Correo" = 'ana2@x.cl' where "IdUsuario" = 1`);
    await permitido(`update "Claves" set "IntentosFallidos" = 0, "BloqueadoHasta" = null where "IdUsuario" = 1`);
    await permitido(`insert into "CorreosPendientes"("Para","Asunto","Html","ClaveUnica") values (array['a@x.cl'],'a','b','k1')`);
  });
  it("llama a las funciones SQL de la aplicación", async () => {
    await permitido(`select listar_pagina('bodegas','',null,0,10)`);
    await permitido(`select buscar_subrecetas('', null, 10)`);
    await db.exec(`insert into "Recetas"("Nombre") values ('PLATO')`);
    await permitido(`select vincular_receta_fudo(1, (select "IdReceta" from "Recetas" limit 1), '1')`);
    await permitido(`select registrar_intento_login('1.1.1.1', 10, 60)`);
    await permitido(`select registrar_fallo_login(1, 5, 15)`);
    await permitido(`select calcular_recetas(array[]::bigint[])`);
    await permitido(`select fijar_clave(1, 'h2', 1, false)`);
  });
});

describe("rol app_servidor: lo que NO puede hacer", () => {
  it("no borra ni vacía nada", async () => {
    for (const t of [...SOLO_LEER, ...LEER_INSERTAR_ACTUALIZAR, ...Object.keys(COLUMNAS), ...SOLO_INSERTAR]) await denegado(`delete from "${t}"`);
    await denegado(`truncate "Productos" cascade`);
  });
  it("no escribe directo en lo crítico (facturas, solicitudes, stock, movimientos, recetas, historial)", async () => {
    await denegado(`insert into "Compras"("IdProveedor","Folio") values (1,1)`);
    await denegado(`update "StockBodega" set "Cantidad" = 999`);
    await denegado(`insert into "MovimientosBodega"("IdProducto") values (1)`);
    await denegado(`update "Solicitudes" set "EstadoSolicitud" = 2`);
    await denegado(`update "Recetas" set "Nombre" = 'X'`);
    await denegado(`insert into "HistorialClaves"("IdUsuario","Password") values (1,'x')`);
    await denegado(`insert into "HistorialPreciosProducto"("IdProducto") values (1)`);
  });
  it("no cambia una clave ni un RUT directamente, ni lee la cola de correos o el limitador", async () => {
    await denegado(`update "Claves" set "Password" = 'otra' where "IdUsuario" = 1`);
    await denegado(`update "Claves" set "VersionSesion" = 1`);
    await denegado(`update "Usuarios" set "Rut" = '9-9' where "IdUsuario" = 1`);
    await denegado(`select * from "CorreosPendientes"`);
    await denegado(`select * from "IntentosLogin"`);
  });
  it("no ejecuta funciones que la aplicación no usa", async () => {
    await denegado(`select normalizar_busqueda('x')`);
    await denegado(`select etiqueta_producto(1)`);
  });
});
