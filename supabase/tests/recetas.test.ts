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
  await db.exec("create role anon; create role authenticated;");
  const migs = readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const m of migs) await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
  await db.exec(`
    insert into "Usuarios"("Rut","Nombres","Apellidos","Correo") values ('1-9','Ana','Compras','ana@x.cl');
    insert into "Productos"("Codigo","Nombre","UnidadBase","Formato","CostoUnitarioBase") values
      ('HAR','Harina','G','BOLSA',0.001),('ACE','Aceite','ML','BOTELLA',0.002),('SIN','Sin costo','G','BOLSA',null);
  `);
});

const receta = (nombre: string, extra = "") =>
  val(`insert into "Recetas"("Nombre"${extra ? "," + extra.split("|")[0] : ""}) values ('${nombre}'${extra ? "," + extra.split("|")[1] : ""}) returning "IdReceta"`).then(Number);
const linea = (rec: number, dest: string, unidad = "G") =>
  db.query(`insert into "RecetaDetalles"("IdReceta",${dest.split("|")[0]},"PorcionNeta","UnidadMedida") values (${rec},${dest.split("|")[1]},100,'${unidad}')`);

describe("Recetas: cabecera", () => {
  it("guarda código y nombre en MAYÚSCULA y un código vacío queda null", async () => {
    await db.query(`insert into "Recetas"("CodigoReceta","Nombre") values ('  r-01 ','  tira asada ')`);
    expect(await val(`select "CodigoReceta" from "Recetas" where "Nombre"='TIRA ASADA'`)).toBe("R-01");
    await db.query(`insert into "Recetas"("CodigoReceta","Nombre") values ('   ','sin codigo')`);
    expect(await val(`select "CodigoReceta" is null from "Recetas" where "Nombre"='SIN CODIGO'`)).toBe(true);
  });
  it("el nombre y el código son únicos sin distinguir mayúsculas", async () => {
    await fails(`insert into "Recetas"("Nombre") values ('tira asada')`, /Nombre/);
    await fails(`insert into "Recetas"("CodigoReceta","Nombre") values ('r-01','otra')`, /CodigoReceta/);
  });
  it("el rendimiento lleva cantidad y unidad juntas o ninguna", async () => {
    await fails(`insert into "Recetas"("Nombre","RendimientoCantidad") values ('A1',100)`);
    await fails(`insert into "Recetas"("Nombre","RendimientoUnidad") values ('A2','G')`);
    await db.query(`insert into "Recetas"("Nombre","RendimientoCantidad","RendimientoUnidad") values ('A3',100,'G')`);
  });
  it("rechaza porciones y rendimiento no positivos", async () => {
    await fails(`insert into "Recetas"("Nombre","RendimientoPorciones") values ('A4',0)`);
    await fails(`insert into "Recetas"("Nombre","RendimientoCantidad","RendimientoUnidad") values ('A5',0,'G')`);
  });
});

describe("RecetaDetalles: reglas", () => {
  it("exige producto o sub-receta, nunca ambos ni ninguno", async () => {
    const r = await receta("D1"); const s = await receta("D1S", `"RendimientoCantidad","RendimientoUnidad"|100,'G'`);
    await fails(`insert into "RecetaDetalles"("IdReceta","IdProducto","IdSubReceta","PorcionNeta","UnidadMedida") values (${r},1,${s},10,'G')`);
    await fails(`insert into "RecetaDetalles"("IdReceta","PorcionNeta","UnidadMedida") values (${r},10,'G')`);
  });
  it("no repite el mismo producto ni la misma sub-receta en una receta", async () => {
    const r = await receta("D2"); const s = await receta("D2S", `"RendimientoCantidad","RendimientoUnidad"|100,'G'`);
    await linea(r, `"IdProducto"|1`);
    await fails(`insert into "RecetaDetalles"("IdReceta","IdProducto","PorcionNeta","UnidadMedida") values (${r},1,5,'G')`);
    await linea(r, `"IdSubReceta"|${s}`);
    await fails(`insert into "RecetaDetalles"("IdReceta","IdSubReceta","PorcionNeta","UnidadMedida") values (${r},${s},5,'G')`);
  });
  it("una receta no se incluye a sí misma", async () => {
    const r = await receta("C1", `"RendimientoCantidad","RendimientoUnidad"|100,'G'`);
    await fails(`insert into "RecetaDetalles"("IdReceta","IdSubReceta","PorcionNeta","UnidadMedida") values (${r},${r},5,'G')`, /sí misma/);
  });
  it("rechaza un ciclo indirecto A→B→A", async () => {
    const a = await receta("CA", `"RendimientoCantidad","RendimientoUnidad"|100,'G'`);
    const b = await receta("CB", `"RendimientoCantidad","RendimientoUnidad"|100,'G'`);
    await linea(a, `"IdSubReceta"|${b}`);
    await fails(`insert into "RecetaDetalles"("IdReceta","IdSubReceta","PorcionNeta","UnidadMedida") values (${b},${a},5,'G')`, /sí misma/);
  });
  it("la sub-receta debe tener rendimiento", async () => {
    const r = await receta("S1"); const s = await receta("S1S");
    await fails(`insert into "RecetaDetalles"("IdReceta","IdSubReceta","PorcionNeta","UnidadMedida") values (${r},${s},5,'G')`, /rendimiento/);
  });
  it("la unidad debe ser de la familia del ingrediente", async () => {
    const r = await receta("U1");
    await fails(`insert into "RecetaDetalles"("IdReceta","IdProducto","PorcionNeta","UnidadMedida") values (${r},1,5,'L')`, /familia/);
    await linea(r, `"IdProducto"|1`, "KG"); // Harina está en G: KG es de su familia
    const s = await receta("U1S", `"RendimientoCantidad","RendimientoUnidad"|100,'G'`);
    await fails(`insert into "RecetaDetalles"("IdReceta","IdSubReceta","PorcionNeta","UnidadMedida") values (${r},${s},5,'ML')`, /familia/);
  });
  it("rechaza cantidad, porción y merma inválidas", async () => {
    const r = await receta("V1");
    await fails(`insert into "RecetaDetalles"("IdReceta","IdProducto","Cantidad","PorcionNeta","UnidadMedida") values (${r},2,0,5,'ML')`);
    await fails(`insert into "RecetaDetalles"("IdReceta","IdProducto","PorcionNeta","UnidadMedida") values (${r},2,0,'ML')`);
    await fails(`insert into "RecetaDetalles"("IdReceta","IdProducto","PorcionNeta","PorcentajeMerma","UnidadMedida") values (${r},2,5,-0.1,'ML')`);
  });
});

describe("Recetas: bloqueos por uso", () => {
  it("no se desactiva una receta usada como sub-receta de una vigente", async () => {
    const r = await receta("B1"); const s = await receta("B1S", `"RendimientoCantidad","RendimientoUnidad"|100,'G'`);
    await linea(r, `"IdSubReceta"|${s}`);
    await fails(`update "Recetas" set "IdEstado"=0 where "IdReceta"=${s}`, /sub-receta/);
    await db.query(`update "Recetas" set "IdEstado"=0 where "IdReceta"=${r}`);
    await db.query(`update "Recetas" set "IdEstado"=0 where "IdReceta"=${s}`);
  });
  it("no cambia el rendimiento de una sub-receta en uso a otra familia", async () => {
    const r = await receta("B2"); const s = await receta("B2S", `"RendimientoCantidad","RendimientoUnidad"|100,'G'`);
    await linea(r, `"IdSubReceta"|${s}`);
    await fails(`update "Recetas" set "RendimientoUnidad"='ML' where "IdReceta"=${s}`, /rendimiento/);
    await fails(`update "Recetas" set "RendimientoCantidad"=null,"RendimientoUnidad"=null where "IdReceta"=${s}`, /rendimiento/);
    await db.query(`update "Recetas" set "RendimientoUnidad"='KG',"RendimientoCantidad"=2 where "IdReceta"=${s}`);
  });
  it("no cambia base/factor de una unidad usada por recetas", async () => {
    await fails(`update "UnidadesMedida" set "Factor"=2000 where "Codigo"='KG'`, /unidad/i);
  });
  it("no cambia la unidad base de un producto usado en recetas", async () => {
    const id = Number(await val(`insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values ('USO','En receta','G','BOLSA') returning "IdProducto"`));
    const r = await receta("B3"); await linea(r, `"IdProducto"|${id}`);
    await fails(`update "Productos" set "UnidadBase"='ML' where "IdProducto"=${id}`, /receta/);
  });
});

describe("permisos de Recetas", () => {
  it("el rol Compras recibe recetas.ver y recetas.gestionar", async () => {
    const r = await db.query<any>(`select "Permiso" from "RolesPermisos" rp join "Roles" r using("IdRol") where r."NombreRol"='Compras' and "Permiso" like 'recetas.%' order by 1`);
    expect(r.rows.map((x) => x.Permiso)).toEqual(["recetas.gestionar", "recetas.ver"]);
  });
});
