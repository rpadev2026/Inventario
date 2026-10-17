import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Migración 0039: el tamaño de la expansión de una receta (con todas las que la contienen) tiene tope y se mide sin recorrer caminos. */
const dir = join(__dirname, "..");
let db: PGlite;
const val = async (sql: string) => Object.values((await db.query<any>(sql)).rows[0])[0] as any;
const fails = (sql: string, msg: RegExp) => expect(db.query(sql)).rejects.toThrow(msg);
let producto = 0;

/** Crea una receta con rendimiento (para poder usarla como sub-receta) y devuelve su id. */
const receta = async (nombre: string) =>
  Number(await val(`insert into "Recetas"("Nombre","RendimientoCantidad","RendimientoUnidad") values ('${nombre}', 1, 'KG') returning "IdReceta"`));
const conProducto = (id: number) =>
  db.query(`insert into "RecetaDetalles"("IdReceta","IdProducto","Cantidad","PorcionNeta","UnidadMedida") values (${id}, ${producto}, 1, 100, 'G')`);
const conSub = (id: number, sub: number) =>
  db.query(`insert into "RecetaDetalles"("IdReceta","IdSubReceta","Cantidad","PorcionNeta","UnidadMedida") values (${id}, ${sub}, 1, 100, 'G')`);
const tamano = async (id: number) => Number(await val(`select tamano_expansion_receta(${id})`));

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  for (const m of readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readFileSync(join(dir, "migrations", m), "utf8"));
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
  await db.exec(`insert into "Productos"("Codigo","Nombre","UnidadBase","Formato") values ('HAR','Harina','G','BOLSA')`);
  producto = Number(await val(`select "IdProducto" from "Productos" where "Codigo" = 'HAR'`));
});

describe("tamano_expansion_receta", () => {
  it("una receta sin sub-recetas visita solo a sí misma", async () => {
    const a = await receta("SOLA"); await conProducto(a);
    expect(await tamano(a)).toBe(1);
  });
  it("cuenta cada aparición: un rombo A→B,C y B,C→D visita 5 recetas", async () => {
    const d = await receta("D"); await conProducto(d);
    const b = await receta("B"); await conSub(b, d);
    const c = await receta("C"); await conSub(c, d);
    const a = await receta("A"); await conSub(a, b); await conSub(a, c);
    expect(await tamano(a)).toBe(5);
  });
});

describe("tope al guardar sub-recetas (0039)", () => {
  // Regresión (auditoría de seguridad): capas de recetas que incluyen a todas las de la capa inferior hacían crecer el trabajo
  // como m^k sin ningún límite al guardar.
  it("una receta normal (plato → masa → harina) se guarda sin problema", async () => {
    const masa = await receta("MASA"); await conProducto(masa);
    const plato = await receta("PLATO"); await conSub(plato, masa); await conProducto(plato);
    expect(await tamano(plato)).toBe(2);
  });
  it("capas de 4 recetas que incluyen a todas las de abajo: se acepta hasta 341 visitas y se rechaza al pasar de 500", async () => {
    let capa: number[] = [];
    for (let i = 0; i < 4; i++) { const r = await receta(`C0-${i}`); await conProducto(r); capa.push(r); }
    const tamanos = [1];
    for (let nivel = 1; nivel <= 4; nivel++) { // tamaños 5, 21, 85, 341: todos aceptados
      const siguiente: number[] = [];
      for (let i = 0; i < 4; i++) { const r = await receta(`C${nivel}-${i}`); for (const sub of capa) await conSub(r, sub); siguiente.push(r); }
      capa = siguiente; tamanos.push(await tamano(capa[0]));
    }
    expect(tamanos).toEqual([1, 5, 21, 85, 341]);
    const exceso = await receta("C5-0");
    await conSub(exceso, capa[0]); // 1 + 341 = 342
    await fails(`insert into "RecetaDetalles"("IdReceta","IdSubReceta","Cantidad","PorcionNeta","UnidadMedida") values (${exceso}, ${capa[1]}, 1, 100, 'G')`, /demasiado grande/); // 683
    expect(Number(await val(`select count(*) from "RecetaDetalles" where "IdReceta" = ${exceso}`))).toBe(1); // la línea rechazada no quedó
  });
  it("editar una sub-receta de abajo no puede dejar demasiado grande a una receta que la contiene", async () => {
    const hoja = await receta("HOJA"); await conProducto(hoja);
    const tope = await receta("TOPE"); await conSub(tope, hoja);
    const medio: number[] = [];
    for (let i = 0; i < 6; i++) { const m = await receta(`M${i}`); await conSub(m, hoja); medio.push(m); await conSub(tope, m); } // 1 + 1 + 6*2 = 14
    expect(await tamano(tope)).toBe(14);
    // Se infla "hoja" con 4 capas de 4 recetas (341 visitas): "hoja" sola pesaría 342, pero "tope" la cuenta 7 veces y pasaría de 500.
    let capa: number[] = [];
    for (let i = 0; i < 4; i++) { const r = await receta(`XH-${i}`); await conProducto(r); capa.push(r); }
    for (let nivel = 0; nivel < 4; nivel++) {
      const sig: number[] = [];
      for (let i = 0; i < 4; i++) { const r = await receta(`X${nivel}-${i}`); for (const sub of capa) await conSub(r, sub); sig.push(r); }
      capa = sig;
    }
    expect(await tamano(capa[0])).toBe(341);
    await fails(`insert into "RecetaDetalles"("IdReceta","IdSubReceta","Cantidad","PorcionNeta","UnidadMedida") values (${hoja}, ${capa[0]}, 1, 100, 'G')`, /receta TOPE es demasiado grande/i);
    expect(await tamano(tope)).toBe(14); // el cambio rechazado no dejó nada
  });
  it("más de 21 niveles de sub-recetas se rechazan al guardar", async () => {
    const cadena: number[] = [];
    for (let i = 0; i < 22; i++) { const r = await receta(`N${i}`); cadena.push(r); }
    await conProducto(cadena[21]);
    for (let i = 20; i >= 1; i--) await conSub(cadena[i], cadena[i + 1]); // N1 -> ... -> N21: 21 niveles, aceptado
    expect(await tamano(cadena[1])).toBe(21);
    await fails(`insert into "RecetaDetalles"("IdReceta","IdSubReceta","Cantidad","PorcionNeta","UnidadMedida") values (${cadena[0]}, ${cadena[1]}, 1, 100, 'G')`, /demasiados niveles/);
  });
});
