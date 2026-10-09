import { describe, it, expect, vi, beforeEach } from "vitest";

const llamadas: { op: string; fila: Record<string, unknown>; eq?: [string, unknown] }[] = [];
let errorSimulado: { code: string; message?: string } | null = null;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../db/supabase", () => ({
  db: {
    from: () => ({
      insert: async (fila: Record<string, unknown>) => { llamadas.push({ op: "insert", fila }); return { error: errorSimulado }; },
      update: (fila: Record<string, unknown>) => ({
        eq: async (c: string, v: unknown) => { llamadas.push({ op: "update", fila, eq: [c, v] }); return { error: errorSimulado }; },
      }),
    }),
  },
}));

import { CATALOGOS, guardarCatalogo, prepararFila, propsFormCatalogo, validarEntradaCatalogo } from "./catalogo";
import { catalogoSchema } from "../validation/catalogo";

const cfg = CATALOGOS.formasPago;
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

beforeEach(() => { llamadas.length = 0; errorSimulado = null; });

describe("prepararFila", () => {
  it("normaliza el código a mayúsculas al crear", () => {
    const d = catalogoSchema.parse({ codigo: " contado ", nombre: "Contado", estado: "1" });
    const f = prepararFila(cfg, d, 7, false);
    expect(f).toMatchObject({ Codigo: "CONTADO", Nombre: "CONTADO", IdEstado: 1, IdUsuarioCreacion: 7, IdUsuarioModificacion: 7 });
  });
  it("al editar no incluye Codigo", () => {
    const d = catalogoSchema.parse({ codigo: "otro", nombre: "X", estado: "0" });
    const f = prepararFila(cfg, d, 7, true);
    expect(f).not.toHaveProperty("Codigo");
    expect(f).toEqual({ Nombre: "X", IdEstado: 0, IdUsuarioModificacion: 7 });
  });
});

describe("guardarCatalogo", () => {
  it("guarda CONTADO al escribir contado", async () => {
    const r = await guardarCatalogo(cfg, 1, fd({ codigo: "contado", nombre: "Contado", estado: "1" }));
    expect(r).toEqual({ ok: true });
    expect(llamadas[0].op).toBe("insert");
    expect(llamadas[0].fila.Codigo).toBe("CONTADO");
  });
  it("editar con otro código no lo cambia", async () => {
    const r = await guardarCatalogo(cfg, 1, fd({ modo: "editar", codigo: "contado", nombre: "Nuevo", estado: "0" }));
    expect(r.ok).toBe(true);
    expect(llamadas[0].op).toBe("update");
    expect(llamadas[0].fila).not.toHaveProperty("Codigo");
    expect(llamadas[0].eq).toEqual(["Codigo", "CONTADO"]);
  });
  it("duplicado devuelve mensaje de negocio", async () => {
    errorSimulado = { code: "23505" };
    const r = await guardarCatalogo(cfg, 1, fd({ codigo: "efectivo", nombre: "Efectivo" }));
    expect(r).toEqual({ error: "Ya existe un registro con ese código" });
  });
  it("otro error no filtra detalles", async () => {
    errorSimulado = { code: "XX000" };
    const r = await guardarCatalogo(cfg, 1, fd({ codigo: "A", nombre: "A" }));
    expect(r).toEqual({ error: "No se pudo guardar" });
  });
  it("código inválido se rechaza sin tocar la BD", async () => {
    const r = await guardarCatalogo(cfg, 1, fd({ codigo: "a b", nombre: "A" }));
    expect(r.error).toBeTruthy();
    expect(llamadas).toHaveLength(0);
  });
});

describe("catálogos territoriales", () => {
  const com = CATALOGOS.comunas;
  const ciu = CATALOGOS.ciudades;
  const reg = CATALOGOS.regiones;

  it("configuración de las tres claves nuevas", () => {
    expect(reg).toMatchObject({ tabla: "Regiones", id: "IdRegion", ruta: "/mantenedores/regiones", titulo: "Regiones" });
    expect(ciu).toMatchObject({ tabla: "Provincias", id: "IdProvincia", ruta: "/mantenedores/ciudades", titulo: "Ciudades (provincias)", padre: { columna: "CodigoRegion", tabla: "Regiones", etiqueta: "Región" } });
    expect(com).toMatchObject({ tabla: "Comunas", id: "IdComuna", ruta: "/mantenedores/comunas", titulo: "Comunas", padre: { columna: "CodigoProvincia", tabla: "Provincias", etiqueta: "Ciudad (provincia)" } });
    expect(reg.patronCodigo?.test("13")).toBe(true);
    expect(ciu.patronCodigo?.test("131")).toBe(true);
    expect(com.patronCodigo?.test("13101")).toBe(true);
  });

  it("prepararFila al crear una comuna incluye CodigoProvincia", () => {
    const f = prepararFila(com, { codigo: "13101", nombre: "Santiago", estado: 1, padre: "131" }, 3, false);
    expect(f).toMatchObject({ Codigo: "13101", CodigoProvincia: "131", Nombre: "Santiago" });
  });
  it("prepararFila al editar no incluye Codigo ni CodigoProvincia", () => {
    const f = prepararFila(com, { codigo: "13101", nombre: "Santiago", estado: 1, padre: "131" }, 3, true);
    expect(f).not.toHaveProperty("Codigo");
    expect(f).not.toHaveProperty("CodigoProvincia");
  });

  it.each([
    ["regiones", "1A"], ["regiones", "123"], ["ciudades", "13A"], ["ciudades", "13"], ["comunas", "1310A"], ["comunas", "1310"],
  ] as const)("%s rechaza código %s sin tocar la BD", async (k, codigo) => {
    const r = await guardarCatalogo(CATALOGOS[k], 1, fd({ codigo, nombre: "X", estado: "1", padre: "13" }));
    expect(r.error).toBe(CATALOGOS[k].ayudaCodigo);
    expect(llamadas).toHaveLength(0);
  });

  it("exige padre al crear ciudades y comunas", async () => {
    expect(await guardarCatalogo(ciu, 1, fd({ codigo: "131", nombre: "Santiago" }))).toEqual({ error: "Elija Región" });
    expect(await guardarCatalogo(com, 1, fd({ codigo: "13101", nombre: "Santiago" }))).toEqual({ error: "Elija Ciudad (provincia)" });
    expect(llamadas).toHaveLength(0);
  });
  it("al editar no exige padre", () => {
    const r = validarEntradaCatalogo(com, fd({ modo: "editar", codigo: "13101", nombre: "Santiago" }));
    expect(r.error).toBeUndefined();
    expect(r.datos?.codigo).toBe("13101");
  });
  it("validarEntradaCatalogo devuelve datos con padre", () => {
    const r = validarEntradaCatalogo(com, fd({ codigo: "13101", nombre: "Santiago", padre: "131" }));
    expect(r.datos).toMatchObject({ codigo: "13101", padre: "131", estado: 1 });
  });
  it("crea una comuna con su padre", async () => {
    const r = await guardarCatalogo(com, 1, fd({ codigo: "13101", nombre: "Santiago", estado: "1", padre: "131" }));
    expect(r).toEqual({ ok: true });
    expect(llamadas[0].fila).toMatchObject({ Codigo: "13101", CodigoProvincia: "131" });
  });

  it("el código debe comenzar con el código del padre", async () => {
    expect(await guardarCatalogo(com, 1, fd({ codigo: "13101", nombre: "Santiago", padre: "051" }))).toEqual({ error: "El código debe comenzar con 051" });
    expect(await guardarCatalogo(ciu, 1, fd({ codigo: "131", nombre: "Santiago", padre: "05" }))).toEqual({ error: "El código debe comenzar con 05" });
    expect(llamadas).toHaveLength(0);
    expect(validarEntradaCatalogo(com, fd({ codigo: "13101", nombre: "Santiago", padre: "131" })).error).toBeUndefined();
    expect(validarEntradaCatalogo(ciu, fd({ codigo: "131", nombre: "Santiago", padre: "13" })).error).toBeUndefined();
  });
  it("al editar no se exige el prefijo del padre", () => {
    expect(validarEntradaCatalogo(com, fd({ modo: "editar", codigo: "13101", nombre: "Santiago", padre: "051" })).error).toBeUndefined();
  });

  it("P0001 devuelve el mensaje de negocio", async () => {
    errorSimulado = { code: "P0001", message: "No se puede desactivar: tiene ciudades vigentes" };
    const r = await guardarCatalogo(reg, 1, fd({ modo: "editar", codigo: "13", nombre: "RM", estado: "0" }));
    expect(r).toEqual({ error: "No se puede desactivar: tiene ciudades vigentes" });
  });
  it("23503 informa padre inexistente", async () => {
    errorSimulado = { code: "23503" };
    const r = await guardarCatalogo(com, 1, fd({ codigo: "99901", nombre: "Santiago", padre: "999" }));
    expect(r).toEqual({ error: "El padre elegido no existe" });
  });
});

describe("propsFormCatalogo (frontera servidor -> cliente)", () => {
  function esSerializable(v: unknown): boolean {
    if (v === null || ["string", "number", "boolean", "undefined"].includes(typeof v)) return true;
    if (Array.isArray(v)) return v.every(esSerializable);
    if (typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
      return Object.values(v as object).every(esSerializable);
    }
    return false;
  }

  it("el cfg completo NO es serializable (contiene RegExp) y la detección lo nota", () => {
    expect(esSerializable(CATALOGOS.regiones)).toBe(false);
  });

  it.each(Object.keys(CATALOGOS) as (keyof typeof CATALOGOS)[])("%s: solo datos planos serializables", (k) => {
    const props = propsFormCatalogo(CATALOGOS[k]);
    expect(esSerializable(props)).toBe(true);
    expect(JSON.parse(JSON.stringify(props))).toEqual(props);
  });

  it("deriva codigoNumerico, ayuda y padre", () => {
    expect(propsFormCatalogo(CATALOGOS.formasPago)).toEqual({ codigoNumerico: false });
    expect(propsFormCatalogo(CATALOGOS.regiones)).toEqual({ codigoNumerico: true, ayudaCodigo: "2 dígitos, código CUT" });
    expect(propsFormCatalogo(CATALOGOS.comunas).padre).toEqual({ columna: "CodigoProvincia", etiqueta: "Ciudad (provincia)" });
  });
});

describe("unidades de medida: unidad base y factor", () => {
  const cfgU = CATALOGOS.unidades;
  const base = { codigo: "caj12", nombre: "Caja 12", estado: "1" };

  it("exige unidad base y factor", () => {
    expect(validarEntradaCatalogo(cfgU, fd(base)).error).toBeDefined();
    expect(validarEntradaCatalogo(cfgU, fd({ ...base, unidadBase: "UN" })).error).toBeDefined();
  });
  it.each(["0", "", "abc", "-2", "1,1234567"])("rechaza factor %j", (factor) => {
    expect(validarEntradaCatalogo(cfgU, fd({ ...base, unidadBase: "UN", factor })).error).toBe("Factor: número mayor que 0 (hasta 6 decimales)");
  });
  it("acepta factor con coma o punto y lo convierte", () => {
    expect(validarEntradaCatalogo(cfgU, fd({ ...base, unidadBase: "un", factor: "1,5" })).datos).toMatchObject({ unidadBase: "UN", factor: 1.5 });
    expect(validarEntradaCatalogo(cfgU, fd({ ...base, unidadBase: "UN", factor: "1000" })).datos?.factor).toBe(1000);
  });
  it.each(["1.000", "1.500.000", "12.345"])("rechaza el factor %j: el punto como separador de miles se confunde con un decimal", (factor) => {
    expect(validarEntradaCatalogo(cfgU, fd({ ...base, unidadBase: "UN", factor })).error).toBe("Factor: escriba 1000, sin separador de miles (decimales con coma)");
  });
  it("sigue aceptando decimales con punto de 1 a 2 dígitos y con coma de hasta 6", () => {
    expect(validarEntradaCatalogo(cfgU, fd({ ...base, unidadBase: "UN", factor: "1.5" })).datos?.factor).toBe(1.5);
    expect(validarEntradaCatalogo(cfgU, fd({ ...base, unidadBase: "UN", factor: "0,001" })).datos?.factor).toBe(0.001);
    expect(validarEntradaCatalogo(cfgU, fd({ ...base, unidadBase: "UN", factor: "1,500" })).datos?.factor).toBe(1.5);
  });
  it("unidad base vacía = la misma unidad, y entonces el factor debe ser 1", () => {
    expect(validarEntradaCatalogo(cfgU, fd({ ...base, unidadBase: "", factor: "1" })).datos).toMatchObject({ codigo: "CAJ12", unidadBase: "CAJ12", factor: 1 });
    expect(validarEntradaCatalogo(cfgU, fd({ ...base, unidadBase: "", factor: "12" })).error).toBe("Una unidad base debe tener factor 1");
    expect(validarEntradaCatalogo(cfgU, fd({ ...base, unidadBase: "CAJ12", factor: "12" })).error).toBe("Una unidad base debe tener factor 1");
  });
  it("prepararFila incluye UnidadBase y Factor al crear y al editar (sin Codigo al editar)", () => {
    const d = { codigo: "CAJ12", nombre: "Caja 12", estado: 1, unidadBase: "UN", factor: 12 };
    expect(prepararFila(cfgU, d, 7, false)).toMatchObject({ Codigo: "CAJ12", UnidadBase: "UN", Factor: 12, IdUsuarioCreacion: 7 });
    const ed = prepararFila(cfgU, d, 7, true);
    expect(ed).toMatchObject({ UnidadBase: "UN", Factor: 12 });
    expect(ed).not.toHaveProperty("Codigo");
  });
  it("los demás catálogos no piden ni guardan unidad base", () => {
    const ok = validarEntradaCatalogo(CATALOGOS.formatos, fd({ codigo: "x", nombre: "X", estado: "1" }));
    expect(ok.error).toBeUndefined();
    expect(prepararFila(CATALOGOS.formatos, ok.datos!, 1, false)).not.toHaveProperty("UnidadBase");
  });
  it("propsFormCatalogo marca base solo en unidades", () => {
    expect(propsFormCatalogo(cfgU).base).toBe(true);
    expect(propsFormCatalogo(CATALOGOS.formatos).base).toBeUndefined();
  });
  it("«Dónde se usa» cuenta productos por unidad base y líneas de factura", () => {
    expect(cfgU.uso).toContainEqual(expect.objectContaining({ tabla: "Productos", columna: "UnidadBase" }));
    expect(cfgU.uso).toContainEqual(expect.objectContaining({ tabla: "ComprasDetalle", columna: "UnidadMedida", singular: "línea", plural: "líneas" }));
    expect(cfgU.uso).not.toContainEqual(expect.objectContaining({ tabla: "Productos", columna: "UnidadMedida" }));
  });
  it("«Dónde se usa» cuenta también las líneas y los rendimientos de recetas", () => {
    expect(cfgU.uso).toContainEqual(expect.objectContaining({ tabla: "RecetaDetalles", columna: "UnidadMedida", plural: "líneas" }));
    expect(cfgU.uso).toContainEqual(expect.objectContaining({ tabla: "Recetas", columna: "RendimientoUnidad", plural: "recetas" }));
  });
  it("«Dónde se usa» cuenta también las unidades que la usan como base", () => {
    expect(cfgU.uso).toContainEqual(expect.objectContaining({ tabla: "UnidadesMedida", columna: "UnidadBase" }));
  });
  it("el mensaje del trigger (P0001) llega al usuario al guardar", async () => {
    errorSimulado = { code: "P0001", message: "No se puede cambiar la unidad base ni el factor: hay productos que usan esta unidad" };
    const r = await guardarCatalogo(cfgU, 1, fd({ modo: "editar", codigo: "KG", nombre: "Kilo", estado: "1", unidadBase: "G", factor: "500" }));
    expect(r.error).toMatch(/hay productos que usan esta unidad/);
  });
});
