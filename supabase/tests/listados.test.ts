import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { normalizar } from "../../lib/buscar";
import { filtrarProductos, type ProductoFila } from "../../lib/productos-filtro";
import { filtrarUsuarios, type UsuarioFila } from "../../lib/usuarios-filtro";
import { filtrarBodegas, type BodegaFila } from "../../lib/bodegas-filtro";
import { filtrarProveedores, type ProveedorFila } from "../../lib/proveedores-filtro";

const dir = join(__dirname, "..");
let db: PGlite;
const pagina = async (tabla: string, q: string, estado: number | null, off = 0, lim = 100) =>
  (await db.query<any>(`select listar_pagina($1,$2,$3::smallint,$4,$5) r`, [tabla, q, estado, off, lim])).rows[0].r as { total: number; filas: any[] };

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(`
    insert into "Usuarios"("Rut","Nombres","Apellidos","Correo","IdEstado") values
      ('12345678-5','María José','Muñoz Peña','maria@x.cl',1),('7654321-6','Ángel','Álvarez','angel@x.cl',0),('9999999-9','Zoe','Zúñiga','zoe@x.cl',1);
    insert into "Proveedores"("Rut","RazonSocial","Giro","IdEstado") values
      ('76086428-5','ÁLAMO Y CÍA','VERDURAS',1),('96.1-2','BETA SPA',null,0),('76543210-3','Ñandú Ltda','CARNES Y ABARROTES',1);
    insert into "Bodegas"("NombreBodega","EsCentral") values ('COCINA',false),('BAR ÑUBLE',false),('CENTRAL',true);
    -- Un producto antiguo sin código (hoy no se puede crear: trigger 0040) para que la búsqueda siga cubriendo los códigos nulos.
    alter table "Productos" disable trigger trg_exigir_codigo_producto;
    insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values
      ('AZ-1','AZÚCAR','G','BOLSA'),(null,'ÁJÍ EN POLVO','G','BOLSA'),('P.2','PIMIENTA','G','BOLSA');
    alter table "Productos" enable trigger trg_exigir_codigo_producto;
  `);
});

describe("listar_pagina (P01)", () => {
  it("normalizar_busqueda iguala a normalizar() de lib/buscar.ts", async () => {
    for (const t of ["  María  José ", "12.345.678-5", "ÑANDÚ-Çafé", "AZ-1", ""]) {
      const r = (await db.query<any>(`select normalizar_busqueda($1) n`, [t])).rows[0].n;
      expect(r).toBe(normalizar(t));
    }
  });

  it("usuarios: mismo resultado y orden que filtrarUsuarios", async () => {
    const todos = (await db.query<UsuarioFila>(`select "IdUsuario","Rut","Nombres","Apellidos","Correo","IdEstado" from "Usuarios"`)).rows;
    for (const [q, e] of [["", null], ["alvarez", null], ["12.345.678", null], ["jose munoz", 1], ["X.CL", 0], ["zz", null]] as const) {
      const sql = (await pagina("usuarios", q, e)).filas.map((u) => u.IdUsuario);
      const ts = filtrarUsuarios(todos, { q, estado: e ?? undefined }).map((u) => u.IdUsuario);
      expect(sql, `q=${q} e=${e}`).toEqual(ts);
    }
  });

  it("bodegas y productos: igual que los filtros TS (Central primero; código nulo)", async () => {
    const bod = (await db.query<BodegaFila>(`select "IdBodega","NombreBodega","EsCentral","IdEstado" from "Bodegas"`)).rows;
    for (const q of ["", "nuble", "o"]) {
      expect((await pagina("bodegas", q, null)).filas.map((b) => b.IdBodega)).toEqual(filtrarBodegas(bod, { q }).map((b) => b.IdBodega));
    }
    const prod = (await db.query<ProductoFila>(`select "IdProducto","Codigo","Nombre","IdEstado" from "Productos"`)).rows as ProductoFila[];
    for (const q of ["", "azucar", "aji", "p2", "az1"]) {
      expect((await pagina("productos", q, null)).filas.map((p) => p.IdProducto), `q=${q}`).toEqual(filtrarProductos(prod, { q }).map((p) => p.IdProducto));
    }
  });

  it("proveedores: mismo resultado y orden que filtrarProveedores (RUT con puntos, giro nulo, tildes)", async () => {
    const todos = (await db.query<ProveedorFila>(`select "IdProveedor","Rut","RazonSocial","Giro","Telefono","Correo","IdEstado" from "Proveedores"`)).rows;
    for (const [q, e] of [["", null], ["alamo", null], ["76.086.428", null], ["carnes", 1], ["nandu", null], ["beta", 0], ["zzz", null]] as const) {
      const sql = (await pagina("proveedores", q, e)).filas.map((p) => p.IdProveedor);
      const ts = filtrarProveedores(todos, { q, estado: e ?? undefined }).map((p) => p.IdProveedor);
      expect(sql, `q=${q} e=${e}`).toEqual(ts);
    }
  });

  it("pagina con total correcto y busca registros más allá de 1.000 filas", async () => {
    await db.exec(`insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") select 'IT' || g, 'ITEM ' || lpad(g::text, 5, '0'), 'G', 'BOLSA' from generate_series(1, 1500) g`);
    const p1 = await pagina("productos", "", null, 0, 10);
    expect(p1.total).toBe(1503);
    expect(p1.filas).toHaveLength(10);
    expect((await pagina("productos", "item 01500", null)).filas.map((p) => p.Nombre)).toEqual(["ITEM 01500"]); // el último, fuera de un límite de 1.000
    const ult = await pagina("productos", "", null, 1500, 10);
    expect(ult.filas).toHaveLength(3);
    expect(new Set([...(await pagina("productos", "item", null, 0, 100)).filas, ...(await pagina("productos", "item", null, 100, 100)).filas].map((p) => p.IdProducto)).size).toBe(200); // sin repetir entre páginas
  });

  it("listar_solicitantes: solo quienes han hecho solicitudes, ordenados por apellidos sin tildes", async () => {
    const [{ id: bod }] = (await db.query<any>(`select "IdBodega" id from "Bodegas" where not "EsCentral" limit 1`)).rows;
    const us = (await db.query<any>(`select "IdUsuario" id, "Apellidos" a from "Usuarios"`)).rows;
    const de = (a: string) => us.find((u) => u.a === a).id;
    expect((await db.query<any>(`select listar_solicitantes() r`)).rows[0].r).toEqual([]); // nadie ha solicitado
    await db.exec(`insert into "Solicitudes"("IdUsuarioSolicitante","IdBodegaDestino") values (${de("Zúñiga")}, ${bod}), (${de("Álvarez")}, ${bod}), (${de("Zúñiga")}, ${bod})`);
    const r = (await db.query<any>(`select listar_solicitantes() r`)).rows[0].r as { id: number; nombre: string }[];
    expect(r.map((x) => x.nombre)).toEqual(["Ángel Álvarez", "Zoe Zúñiga"]); // sin repetir; María (sin solicitudes) no aparece
    expect(r[0].id).toBe(de("Álvarez"));
  });

  it("rechaza tablas desconocidas y paginación inválida; el comodín % no es comodín", async () => {
    await expect(db.query(`select listar_pagina('Claves','',null,0,10)`)).rejects.toThrow(/desconocido/);
    await expect(db.query(`select listar_pagina('bodegas','',null,0,500)`)).rejects.toThrow(/Paginación/);
    expect((await pagina("bodegas", "%", null)).total).toBe(0);
  });
});
