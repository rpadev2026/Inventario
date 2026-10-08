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

const G = (id: number | "null", cab: object, det: unknown) =>
  `select guardar_receta(1, ${id}, '${JSON.stringify(cab)}'::jsonb, '${JSON.stringify(det)}'::jsonb)`;
const CAB = (nombre: string, extra: object = {}) => ({ codigo: null, nombre, porciones: 1, rendimientoCantidad: null, rendimientoUnidad: null, estado: 1, ...extra });
const L = (producto: number, extra: object = {}) => ({ producto, cantidad: 1, porcion: 100, unidad: "G", merma: 0, ...extra });

describe("guardar_receta", () => {
  it("crea la cabecera y los detalles y devuelve el id", async () => {
    const id = Number(await val(G("null", CAB("g uno", { codigo: "g-1", porciones: 4 }), [L(1), L(2, { unidad: "ML" })])));
    expect(await val(`select "CodigoReceta" from "Recetas" where "IdReceta"=${id}`)).toBe("G-1");
    expect(Number(await val(`select count(*) from "RecetaDetalles" where "IdReceta"=${id}`))).toBe(2);
    expect(Number(await val(`select "IdUsuarioCreacion" from "Recetas" where "IdReceta"=${id}`))).toBe(1);
  });
  it("al editar reemplaza todos los detalles", async () => {
    const id = Number(await val(G("null", CAB("g dos"), [L(1), L(2, { unidad: "ML" })])));
    await db.query(G(id, CAB("g dos", { porciones: 2 }), [L(1, { porcion: 250, merma: 0.25 })]));
    expect(Number(await val(`select count(*) from "RecetaDetalles" where "IdReceta"=${id}`))).toBe(1);
    expect(Number(await val(`select "PorcionNeta" from "RecetaDetalles" where "IdReceta"=${id}`))).toBe(250);
    expect(Number(await val(`select "RendimientoPorciones" from "Recetas" where "IdReceta"=${id}`))).toBe(2);
  });
  it("rechaza una receta sin ingredientes", async () => { await fails(G("null", CAB("g vacia"), []), /ingrediente/); });
  it("rechaza ingredientes no vigentes", async () => {
    const p = Number(await val(`insert into "Productos"("Codigo","Nombre","UnidadBase","Formato","IdEstado") values ('NOV','No vigente','G','BOLSA',0) returning "IdProducto"`));
    await fails(G("null", CAB("g nov"), [L(p)]), /vigente/);
    const s = await receta("G SUBNV", `"RendimientoCantidad","RendimientoUnidad","IdEstado"|100,'G',0`);
    await fails(G("null", CAB("g nov2"), [{ subreceta: s, cantidad: 1, porcion: 10, unidad: "G", merma: 0 }]), /vigente/);
  });
  it("rechaza una unidad no vigente", async () => {
    await db.query(`insert into "UnidadesMedida"("Codigo","Nombre","UnidadBase","Factor","IdEstado") values ('GX','Gramo viejo','G',1,0)`);
    await fails(G("null", CAB("g un"), [L(1, { unidad: "GX" })]), /unidad/i);
  });
  it("rechaza ingredientes repetidos", async () => { await fails(G("null", CAB("g rep"), [L(1), L(1)]), /repet/i); });
  it("rechaza merma negativa, cantidad 0 y porciones 0", async () => {
    await fails(G("null", CAB("g m"), [L(1, { merma: -0.1 })]), /merma/i);
    await fails(G("null", CAB("g c"), [L(1, { cantidad: 0 })]), /cantidad/i);
    await fails(G("null", CAB("g p", { porciones: 0 }), [L(1)]), /porciones/i);
  });
  it("producto no numérico: 'Producto no válido'", async () => {
    await fails(G("null", CAB("g pn"), [{ producto: "x", cantidad: 1, porcion: 1, unidad: "G", merma: 0 }]), /Producto no válido/);
  });
  it("estado fuera de 0/1 falla", async () => { await fails(G("null", CAB("g e", { estado: 2 }), [L(1)]), /[Ee]stado/); });
  it("un error en la línea 2 deja la receta como estaba", async () => {
    const id = Number(await val(G("null", CAB("g atom"), [L(1)])));
    await fails(G(id, CAB("g atom cambiada"), [L(2, { unidad: "ML" }), L(1, { unidad: "L" })]), /familia/);
    expect(await val(`select "Nombre" from "Recetas" where "IdReceta"=${id}`)).toBe("G ATOM");
    expect(Number(await val(`select count(*) from "RecetaDetalles" where "IdReceta"=${id}`))).toBe(1);
    expect(Number(await val(`select "IdProducto" from "RecetaDetalles" where "IdReceta"=${id}`))).toBe(1);
  });
  it("un nombre duplicado falla con 23505", async () => {
    await expect(db.query(G("null", CAB("g atom"), [L(1)]))).rejects.toMatchObject({ code: "23505" });
  });
  it("editar una receta que no existe falla", async () => { await fails(G(99999, CAB("g nada"), [L(1)]), /no existe/); });
});

describe("calcular_receta", () => {
  let c1 = 0; // producto con costo 1 por gramo: facilita los números
  const calc = async (id: number) => (await db.query<any>(`select calcular_receta(${id}) as r`)).rows[0].r;
  const crear = async (nombre: string, det: unknown[], cab: object = {}) => Number(await val(G("null", CAB(nombre, cab), det)));
  beforeAll(async () => {
    c1 = Number(await val(`insert into "Productos"("Codigo","Nombre","UnidadBase","Formato","CostoUnitarioBase") values ('C1','Costo uno','G','BOLSA',1) returning "IdProducto"`));
  });

  it("producto con merma: bruto = neto × (1 + merma) y costo = bruto × costo base", async () => {
    const id = await crear("K simple", [L(1, { porcion: 500, merma: 0.3 })]);
    const r = await calc(id);
    expect(r.lineas[0].cantidadBruta).toBeCloseTo(650);
    expect(r.lineas[0].costo).toBeCloseTo(0.65);
    expect(r.total).toBeCloseTo(0.65);
    expect(r.incompleto).toBe(false);
  });
  it("convierte la unidad de la línea (0,5 KG = 500 G) y su bruto queda en la unidad de la línea", async () => {
    const id = await crear("K kilo", [L(1, { porcion: 0.5, unidad: "KG", merma: 0.3 })]);
    const r = await calc(id);
    expect(r.lineas[0].cantidadBruta).toBeCloseTo(0.65);
    expect(r.lineas[0].unidad).toBe("KG");
    expect(r.lineas[0].costo).toBeCloseTo(0.65);
  });
  it("Cantidad multiplica la porción", async () => {
    const id = await crear("K cantidad", [L(1, { cantidad: 2, porcion: 500, merma: 0.3 })]);
    expect((await calc(id)).lineas[0].costo).toBeCloseTo(1.3);
  });
  it("porción por persona = total ÷ RendimientoPorciones, a 2 decimales", async () => {
    const id = await crear("K porciones", [L(c1, { porcion: 100 })], { porciones: 3 });
    const r = await calc(id);
    expect(r.total).toBeCloseTo(100);
    expect(r.porcion).toBeCloseTo(33.33);
  });
  it("sub-receta: usa el costo por unidad base de su rendimiento", async () => {
    const sub = await crear("K bechamel", [L(c1, { porcion: 2000 })], { rendimientoCantidad: 2000, rendimientoUnidad: "G" });
    expect((await calc(sub)).costoPorBase).toBeCloseTo(1);
    const id = await crear("K usa bechamel", [{ subreceta: sub, cantidad: 1, porcion: 400, unidad: "G", merma: 0 }]);
    const r = await calc(id);
    expect(r.lineas[0].tipo).toBe("subreceta");
    expect(r.lineas[0].costo).toBeCloseTo(400);
  });
  it("sub-receta con rendimiento en KG y línea en G", async () => {
    const sub = await crear("K salsa", [L(c1, { porcion: 2000 })], { rendimientoCantidad: 2, rendimientoUnidad: "KG" });
    expect((await calc(sub)).costoPorBase).toBeCloseTo(1);
    const id = await crear("K usa salsa", [{ subreceta: sub, cantidad: 1, porcion: 0.1, unidad: "KG", merma: 0 }]);
    expect((await calc(id)).lineas[0].costo).toBeCloseTo(100);
  });
  it("ingrediente sin costo: línea sin costo, receta incompleta, y el total suma el resto", async () => {
    const id = await crear("K sin costo", [L(c1, { porcion: 10 }), L(3, { porcion: 50 })]);
    const r = await calc(id);
    expect(r.incompleto).toBe(true);
    expect(r.total).toBeCloseTo(10);
    expect(r.lineas.find((l: any) => l.id === 3).sinCosto).toBe(true);
    expect(r.lineas.find((l: any) => l.id === 3).costo).toBeNull();
  });
  it("una sub-receta incompleta deja incompleta a la receta que la usa", async () => {
    const sub = await crear("K sub incompleta", [L(3, { porcion: 100 })], { rendimientoCantidad: 100, rendimientoUnidad: "G" });
    const rs = await calc(sub);
    expect(rs.incompleto).toBe(true);
    expect(rs.costoPorBase).toBeNull();
    const id = await crear("K usa incompleta", [{ subreceta: sub, cantidad: 1, porcion: 50, unidad: "G", merma: 0 }]);
    const r = await calc(id);
    expect(r.incompleto).toBe(true);
    expect(r.lineas[0].sinCosto).toBe(true);
  });
  it("receta inexistente: 'La receta no existe'", async () => { await fails(`select calcular_receta(999999)`, /La receta no existe/); });
});
