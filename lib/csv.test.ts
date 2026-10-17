import { describe, it, expect } from "vitest";
import { aCsv, celdaCsv } from "./csv";

describe("celdaCsv", () => {
  it("números con coma decimal; null y vacío quedan en blanco", () => {
    expect(celdaCsv(1234.5)).toBe("1234,5");
    expect(celdaCsv(-100)).toBe("-100");
    expect(celdaCsv(null)).toBe("");
    expect(celdaCsv(undefined)).toBe("");
    expect(celdaCsv(Number.NaN)).toBe("");
  });
  it("comillas, separador y saltos de línea obligan a entrecomillar", () => {
    expect(celdaCsv('ají "picante"')).toBe('"ají ""picante"""');
    expect(celdaCsv("a;b")).toBe('"a;b"');
    expect(celdaCsv("a\nb")).toBe('"a\nb"');
    expect(celdaCsv("sin nada")).toBe("sin nada");
  });
  // Regresión de seguridad: nombres como «=HYPERLINK(...)» se ejecutarían como fórmula al abrir el CSV en Excel.
  it("neutraliza las fórmulas de los textos, pero no los números", () => {
    for (const t of ["=1+1", "+cmd", "-2+3", "@SUM(A1)", "\tx", "\rx"]) expect(celdaCsv(t).replace(/^"/, "").startsWith("'")).toBe(true);
    expect(celdaCsv("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(celdaCsv(-5)).toBe("-5");
  });
});

describe("aCsv", () => {
  it("BOM, separador ; y saltos \\r\\n", () => {
    const s = aCsv([["Producto", "Cantidad"], ["Harina", 10.5], ["Sal", null]]);
    expect(s.startsWith("﻿")).toBe(true);
    expect(s.slice(1)).toBe("Producto;Cantidad\r\nHarina;10,5\r\nSal;\r\n");
  });
});
