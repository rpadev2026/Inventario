import { describe, it, expect, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname, "..");
const cleanup = readFileSync(join(dir, "scripts", "e2e-cleanup.sql"), "utf8");
let db: PGlite;
const count = async (t: string) => Number((await db.query<any>(`select count(*) c from "${t}"`)).rows[0].c);

// Base nueva por prueba: esquema + semilla + datos "reales" + datos E2E con el flujo completo.
beforeEach(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
  await db.exec(`
    insert into "Usuarios"("Rut","Nombres","Apellidos","Correo") values
      ('1-9','Admin','Real','admin@real.cl'),
      ('90000001-0','E2E','Compras','e2e.compras@example.test'),
      ('90000002-0','E2E','Solicitante','e2e.solicitante@example.test'),
      ('90000004-K','E2E','Administrador','e2e.admin@example.test');
    insert into "Roles"("NombreRol","DetalleRol") values ('Consulta E2E','rol de prueba'),('Consulta Real','rol real');
    insert into "RolesPermisos"("IdRol","Permiso") select "IdRol",'compras.ver' from "Roles" where "NombreRol" in ('Consulta E2E','Consulta Real');
    insert into "UsuariosRoles"("IdUsuario","IdRol") select u."IdUsuario", r."IdRol" from "Usuarios" u, "Roles" r
      where u."Correo" = 'e2e.admin@example.test' and r."NombreRol" in ('Administrador','Consulta E2E');
    insert into "Proveedores"("Rut","RazonSocial") values ('11111111-1','Proveedor Real'),('76086428-5','E2E Distribuidora SpA');
    insert into "Productos"("Codigo","Nombre","UnidadBase","Formato","StockMinimo","StockCritico") values
      ('REAL-1','Real','G','CAJA',5,1),('E2E-HAR','Harina E2E','G','BOLSA',10,5);
    insert into "Bodegas"("NombreBodega") values ('Cocina Real'),('Cocina E2E');
    -- factura real (sube stock real) y factura E2E
    select registrar_factura(1,1,500,'2026-10-01','2026-10-01','CONTADO',840,160,1000,'[{"producto":1,"unidad":"G","precio":100,"cantidad":10}]'::jsonb);
    select registrar_factura(2,2,1001,'2026-10-01','2026-10-01','CONTADO',840,160,1000,'[{"producto":2,"unidad":"G","precio":100,"cantidad":10}]'::jsonb);
    -- solicitud E2E completa (usuario 3 = solicitante E2E, bodega 3 = Cocina E2E)
    select crear_solicitud(3, 3, '[{"producto":2,"cantidad":5}]'::jsonb);
    select cambiar_estado_solicitud(3, 1, 1::smallint);
    select aprobar_solicitud(1, 1, '[{"producto":2,"cantidad":5}]'::jsonb);
    select recepcionar_solicitud(3, 1, '[{"producto":2,"cantidad":5}]'::jsonb);
  `);
});

describe("e2e-cleanup.sql", () => {
  it("borra solo los datos E2E y conserva los reales", async () => {
    await db.exec(cleanup);
    expect(await count("Usuarios")).toBe(1);
    expect((await db.query<any>(`select "Correo" from "Usuarios"`)).rows[0].Correo).toBe("admin@real.cl");
    expect((await db.query<any>(`select "NombreBodega" from "Bodegas" order by 1`)).rows.map((r) => r.NombreBodega)).toEqual(["Bodega Central", "Cocina Real"]);
    expect((await db.query<any>(`select "RazonSocial" from "Proveedores"`)).rows.map((r) => r.RazonSocial)).toEqual(["Proveedor Real"]);
    expect((await db.query<any>(`select "Codigo" from "Productos"`)).rows.map((r) => r.Codigo)).toEqual(["REAL-1"]);
    // lo real intacto: factura, ingreso y stock central de REAL-1
    expect(await count("Compras")).toBe(1);
    expect(await count("BodegaCentral")).toBe(1);
    expect(Number((await db.query<any>(`select "Cantidad" c from "StockBodega" where "IdProducto"=1`)).rows[0].c)).toBe(10);
    // todo lo E2E desapareció
    for (const t of ["Solicitudes", "SolicitudesDetalle", "HistorialSolicitudes", "MovimientosBodega", "ComprasDetalle", "Claves", "UsuariosRoles"])
      expect(await count(t), t).toBe(t === "ComprasDetalle" ? 1 : 0);
    // roles: se va 'Consulta E2E'; quedan los 4 base y el rol real, con sus permisos
    expect((await db.query<any>(`select "NombreRol" from "Roles" where not "EsBase"`)).rows.map((r) => r.NombreRol)).toEqual(["Consulta Real"]);
    expect((await db.query<any>(`select count(*) c from "Roles" where "EsBase"`)).rows[0].c).toBe(4);
    expect((await db.query<any>(`select count(*) c from "RolesPermisos" rp join "Roles" r using ("IdRol") where r."NombreRol"='Consulta Real'`)).rows[0].c).toBe(1);
    // el contador de solicitudes vuelve a 1
    expect(Number((await db.query<any>(`select nextval('seq_numero_solicitud') n`)).rows[0].n)).toBe(1);
  });

  it("desvincula a los usuarios E2E de territorio (auditoría) en vez de abortar", async () => {
    // e2e.admin (IdUsuario 4) desactivó/reactivó una comuna y creó una ciudad de prueba.
    await db.exec(`
      update "Comunas" set "IdUsuarioModificacion" = 4 where "Codigo" = '13123';
      update "Regiones" set "IdUsuarioModificacion" = 4, "IdUsuarioCreacion" = 4 where "Codigo" = '13';
      update "Provincias" set "IdUsuarioCreacion" = 4 where "Codigo" = '131';
    `);
    await db.exec(cleanup);
    expect(await count("Usuarios")).toBe(1);
    expect(await count("Comunas")).toBe(346);
    const c = (await db.query<any>(`select "IdUsuarioModificacion" m from "Comunas" where "Codigo" = '13123'`)).rows[0];
    expect(c.m).toBeNull();
    expect((await db.query<any>(`select "IdUsuarioCreacion" c, "IdUsuarioModificacion" m from "Regiones" where "Codigo"='13'`)).rows[0]).toEqual({ c: null, m: null });
  });

  it("borra también los productos E2E sin código (nombre terminado en ' E2E')", async () => {
    await db.exec(`insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values (null,'Sal E2E','G','CAJA'),(null,'Sal Real','G','CAJA')`);
    await db.exec(cleanup);
    expect((await db.query<any>(`select "Nombre" from "Productos" order by 1`)).rows.map((r) => r.Nombre)).toEqual(["Real", "Sal Real"]);
  });

  it("borra el historial de las facturas y productos E2E y conserva el de los reales", async () => {
    // segunda factura real del producto real con otro precio: 2 filas de historial reales
    await db.exec(`select registrar_factura(1,1,502,'2026-10-02','2026-10-02','CONTADO',168,32,200,'[{"producto":1,"unidad":"G","precio":200,"cantidad":1}]'::jsonb)`);
    const antes = Number((await db.query<any>(`select count(*) c from "HistorialPreciosProducto"`)).rows[0].c);
    expect(antes).toBe(3); // real (2) + E2E (1)
    await db.exec(cleanup);
    const h = (await db.query<any>(`select "IdProducto" p, "CostoBaseNuevo" n from "HistorialPreciosProducto" order by "IdHistorial"`)).rows;
    expect(h).toEqual([{ p: 1, n: "100.000000" }, { p: 1, n: "200.000000" }]);
  });

  it("es idempotente (segunda ejecución no falla ni borra más)", async () => {
    await db.exec(cleanup);
    await db.exec(cleanup);
    expect(await count("Usuarios")).toBe(1);
    expect(await count("Compras")).toBe(1);
  });

  it("aborta sin borrar nada si una solicitud real apunta a la bodega E2E", async () => {
    await db.exec(`
      insert into "Usuarios"("Rut","Nombres","Apellidos","Correo") values ('2-7','Real','Solicitante','real@real.cl');
      select crear_solicitud(5, 3, '[{"producto":2,"cantidad":1}]'::jsonb);
    `);
    await expect(db.exec(cleanup)).rejects.toThrow(/Abortado/);
    expect(await count("Usuarios")).toBe(5);
    expect(await count("Solicitudes")).toBe(2);
    expect(await count("MovimientosBodega")).toBe(1);
  });

  it("aborta si una factura de otro proveedor usa un producto E2E", async () => {
    await db.exec(`select registrar_factura(1,1,501,'2026-10-01','2026-10-01','CONTADO',84,16,100,'[{"producto":2,"unidad":"G","precio":10,"cantidad":10}]'::jsonb);`);
    await expect(db.exec(cleanup)).rejects.toThrow(/Abortado/);
    expect(await count("Compras")).toBe(3);
  });

  it("aborta si un usuario real tiene asignado un rol E2E", async () => {
    await db.exec(`insert into "UsuariosRoles"("IdUsuario","IdRol") select 1, "IdRol" from "Roles" where "NombreRol"='Consulta E2E'`);
    await expect(db.exec(cleanup)).rejects.toThrow(/Abortado/);
    expect(await count("Usuarios")).toBe(4);
  });
});
