// Genera supabase/migrations/0009_territorio_datos.sql desde el servicio oficial DPA del MOP.
// Uso: npm run gen:territorio
import { writeFileSync } from "node:fs";
import { construirSql, unirTerritorio, type FilaComuna } from "./territorio.ts";

const BASE = "https://rest-sit.mop.gob.cl/arcgis/rest/services/INTEROP/SERVICIO_DPA/MapServer";
const CAMPOS = "CUT_REG,CUT_PROV,CUT_COM,REGION,PROVINCIA,COMUNA";
const SALIDA = new URL("../supabase/migrations/0009_territorio_datos.sql", import.meta.url);

async function descargar(): Promise<FilaComuna[]> {
  const filas: FilaComuna[] = [];
  let offset = 0;
  for (;;) {
    const url =
      `${BASE}/1/query?where=1%3D1&outFields=${CAMPOS}&returnGeometry=false` +
      `&orderByFields=CUT_COM&resultOffset=${offset}&f=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} al consultar ${url}`);
    const json = (await res.json()) as {
      features?: { attributes: FilaComuna }[];
      exceededTransferLimit?: boolean;
      error?: { message?: string };
    };
    if (json.error || !json.features) throw new Error(`Respuesta inválida: ${json.error?.message ?? "sin features"}`);
    filas.push(...json.features.map((f) => f.attributes));
    if (!json.exceededTransferLimit || json.features.length === 0) break;
    offset += json.features.length;
  }
  return filas;
}

const filas = await descargar();
const t = unirTerritorio(filas);
const cabecera =
  `-- Datos oficiales de regiones, provincias (ciudades) y comunas de Chile.\n` +
  `-- Fuente: MOP, servicio DPA (${BASE}), capa 1.\n` +
  `-- Fecha de consulta: ${new Date().toISOString().slice(0, 10)}.\n` +
  `-- Nota: el servicio entrega ${filas.length} comunas; se agregó a mano Antártica (CUT 12202,\n` +
  `-- provincia 122 Antártica Chilena, región 12) para completar las 346.\n` +
  `-- Generado por scripts/generar-territorio.ts; no editar a mano.\n\n`;
writeFileSync(SALIDA, cabecera + construirSql(t), "utf8");
console.log(`${t.regiones.length} regiones, ${t.provincias.length} provincias, ${t.comunas.length} comunas`);
