/**
 * CSV para Excel en español (Chile): separador «;», decimales con coma, UTF-8 con BOM y saltos \r\n.
 * Los textos que empiezan con = + - @ (o tabulación/retorno) se escriben con un apóstrofe delante: Excel los trataría como una
 * fórmula (inyección de fórmulas desde nombres de productos, proveedores, etc.). Los números no se tocan: un -100 es un número.
 */
export type CeldaCsv = string | number | null | undefined;

const PELIGROSO = /^[=+\-@\t\r]/;

export function celdaCsv(v: CeldaCsv): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v).replace(".", ",") : "";
  const t = PELIGROSO.test(v) ? `'${v}` : v;
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function aCsv(filas: CeldaCsv[][]): string {
  return "﻿" + filas.map((f) => f.map(celdaCsv).join(";")).join("\r\n") + "\r\n";
}
