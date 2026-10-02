import { describe, expect, it } from "vitest";
import { construirSql, unirTerritorio, type FilaComuna } from "./territorio.ts";

const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** 16 regiones, 56 provincias y 345 comunas (sin Antártica 12202) con códigos coherentes. */
function filasSinteticas(): FilaComuna[] {
  const filas: FilaComuna[] = [];
  let extras = 14;
  for (let r = 1; r <= 16; r++) {
    const nProv = r <= 8 ? 4 : 3;
    for (let p = 1; p <= nProv; p++) {
      const cutReg = pad(r, 2);
      const cutProv = `${cutReg}${p}`;
      let nCom = 6;
      if (cutProv === "122") nCom = 1;
      else if (extras > 0) {
        nCom = 7;
        extras--;
      }
      for (let c = 1; c <= nCom; c++) {
        filas.push({
          CUT_REG: cutReg,
          CUT_PROV: cutProv,
          CUT_COM: `${cutProv}${pad(c, 2)}`,
          REGION: `Región ${r}`,
          PROVINCIA: cutProv === "122" ? "Antártica Chilena" : `Provincia ${cutProv}`,
          COMUNA: `Comuna ${cutProv}${pad(c, 2)}`,
        });
      }
    }
  }
  return filas;
}

describe("unirTerritorio", () => {
  it("la fixture tiene 345 comunas y agrega Antártica (346)", () => {
    const filas = filasSinteticas();
    expect(filas).toHaveLength(345);
    const t = unirTerritorio(filas);
    expect(t.regiones).toHaveLength(16);
    expect(t.provincias).toHaveLength(56);
    expect(t.comunas).toHaveLength(346);
    expect(t.comunas.find((c) => c.codigo === "12202")).toEqual({
      codigo: "12202",
      nombre: "Antártica",
      codigoProvincia: "122",
    });
  });

  it("no duplica Antártica si ya viene", () => {
    const filas = filasSinteticas();
    filas.push({
      CUT_REG: "12",
      CUT_PROV: "122",
      CUT_COM: "12202",
      REGION: "Región 12",
      PROVINCIA: "Antártica Chilena",
      COMUNA: "Antártica",
    });
    const t = unirTerritorio(filas);
    expect(t.comunas).toHaveLength(346);
    expect(t.comunas.filter((c) => c.codigo === "12202")).toHaveLength(1);
  });

  it("lanza si falta una provincia (55)", () => {
    const filas = filasSinteticas().filter((f) => f.CUT_PROV !== "011");
    expect(() => unirTerritorio(filas)).toThrow();
  });

  it("lanza si una comuna 01101 está bajo la provincia 021", () => {
    const filas = filasSinteticas().map((f) =>
      f.CUT_COM === "01101" ? { ...f, CUT_PROV: "021", CUT_REG: "02" } : f,
    );
    expect(() => unirTerritorio(filas)).toThrow();
  });

  it("ordena por código", () => {
    const t = unirTerritorio(filasSinteticas().reverse());
    const cods = t.comunas.map((c) => c.codigo);
    expect(cods).toEqual([...cods].sort());
  });
});

describe("construirSql", () => {
  it("escapa comillas y respeta el orden regiones, provincias, comunas", () => {
    const sql = construirSql({
      regiones: [{ codigo: "06", nombre: "Región del Libertador General Bernardo O'Higgins" }],
      provincias: [{ codigo: "061", nombre: "Cachapoal", codigoRegion: "06" }],
      comunas: [{ codigo: "06101", nombre: "Rancagua", codigoProvincia: "061" }],
    });
    expect(sql).toContain("O''Higgins");
    const a = sql.indexOf('insert into "Regiones"');
    const b = sql.indexOf('insert into "Provincias"');
    const c = sql.indexOf('insert into "Comunas"');
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
});
