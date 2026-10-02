export type FilaComuna = {
  CUT_REG: string;
  CUT_PROV: string;
  CUT_COM: string;
  REGION: string;
  PROVINCIA: string;
  COMUNA: string;
};

export type Territorio = {
  regiones: { codigo: string; nombre: string }[];
  provincias: { codigo: string; nombre: string; codigoRegion: string }[];
  comunas: { codigo: string; nombre: string; codigoProvincia: string }[];
};

const ANTARTICA: FilaComuna = {
  CUT_REG: "12",
  CUT_PROV: "122",
  CUT_COM: "12202",
  REGION: "Región de Magallanes y de la Antártica Chilena",
  PROVINCIA: "Antártica Chilena",
  COMUNA: "Antártica",
};

const porCodigo = (a: { codigo: string }, b: { codigo: string }) =>
  a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0;

export function unirTerritorio(filas: FilaComuna[]): Territorio {
  const limpias = filas.map((f) => ({
    CUT_REG: f.CUT_REG.trim(),
    CUT_PROV: f.CUT_PROV.trim(),
    CUT_COM: f.CUT_COM.trim(),
    REGION: f.REGION.trim(),
    PROVINCIA: f.PROVINCIA.trim(),
    COMUNA: f.COMUNA.trim(),
  }));
  if (!limpias.some((f) => f.CUT_COM === ANTARTICA.CUT_COM)) {
    // Si la región 12 ya viene en la fuente se reutiliza su nombre oficial.
    const reg12 = limpias.find((f) => f.CUT_REG === "12");
    limpias.push({ ...ANTARTICA, REGION: reg12?.REGION ?? ANTARTICA.REGION });
  }

  const regiones = new Map<string, { codigo: string; nombre: string }>();
  const provincias = new Map<string, { codigo: string; nombre: string; codigoRegion: string }>();
  const comunas = new Map<string, { codigo: string; nombre: string; codigoProvincia: string }>();
  for (const f of limpias) {
    if (!f.CUT_PROV.startsWith(f.CUT_REG)) {
      throw new Error(`Provincia ${f.CUT_PROV} incoherente con la región ${f.CUT_REG}`);
    }
    if (!f.CUT_COM.startsWith(f.CUT_PROV)) {
      throw new Error(`Comuna ${f.CUT_COM} incoherente con la provincia ${f.CUT_PROV}`);
    }
    if (!regiones.has(f.CUT_REG)) regiones.set(f.CUT_REG, { codigo: f.CUT_REG, nombre: f.REGION });
    if (!provincias.has(f.CUT_PROV)) {
      provincias.set(f.CUT_PROV, { codigo: f.CUT_PROV, nombre: f.PROVINCIA, codigoRegion: f.CUT_REG });
    }
    if (!comunas.has(f.CUT_COM)) {
      comunas.set(f.CUT_COM, { codigo: f.CUT_COM, nombre: f.COMUNA, codigoProvincia: f.CUT_PROV });
    }
  }

  const t: Territorio = {
    regiones: [...regiones.values()].sort(porCodigo),
    provincias: [...provincias.values()].sort(porCodigo),
    comunas: [...comunas.values()].sort(porCodigo),
  };
  if (t.regiones.length !== 16 || t.provincias.length !== 56 || t.comunas.length !== 346) {
    throw new Error(
      `Totales inesperados: ${t.regiones.length} regiones, ${t.provincias.length} provincias, ${t.comunas.length} comunas (se esperaban 16/56/346)`,
    );
  }
  return t;
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

function insertar(tabla: string, columnas: string[], filas: string[][]): string {
  const cols = columnas.map((c) => `"${c}"`).join(", ");
  const valores = filas.map((f) => `  (${f.map(q).join(", ")})`).join(",\n");
  return `insert into "${tabla}" (${cols}) values\n${valores};\n`;
}

export function construirSql(t: Territorio): string {
  return [
    insertar("Regiones", ["Codigo", "Nombre"], t.regiones.map((r) => [r.codigo, r.nombre])),
    insertar(
      "Provincias",
      ["Codigo", "Nombre", "CodigoRegion"],
      t.provincias.map((p) => [p.codigo, p.nombre, p.codigoRegion]),
    ),
    insertar(
      "Comunas",
      ["Codigo", "Nombre", "CodigoProvincia"],
      t.comunas.map((c) => [c.codigo, c.nombre, c.codigoProvincia]),
    ),
  ].join("\n");
}
