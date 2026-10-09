import { describe, it, expect } from "vitest";
import { recetaSchema } from "./schemas";

describe("recetaSchema", () => {
  const linea = { tipo: "producto", ingrediente: 1, cantidad: 1, porcion: 500, unidad: "g", merma: 30 };
  const r = { nombre: " tira asada ", porciones: 4, detalle: [linea] };
  it("convierte código y nombre a MAYÚSCULA y la merma de % a fracción", () => {
    const x = recetaSchema.safeParse({ ...r, codigo: "tir-1" });
    expect(x.success).toBe(true);
    if (x.success) {
      expect(x.data.nombre).toBe("TIRA ASADA");
      expect(x.data.codigo).toBe("TIR-1");
      expect(x.data.detalle[0].merma).toBe(0.3);
      expect(x.data.detalle[0].unidad).toBe("G");
      expect(x.data.estado).toBe(1);
    }
  });
  it("acepta cantidades con coma como texto", () => {
    const x = recetaSchema.safeParse({ ...r, detalle: [{ ...linea, cantidad: "2", porcion: "0,5", merma: "12,5" }] });
    expect(x.success).toBe(true);
    if (x.success) expect([x.data.detalle[0].porcion, x.data.detalle[0].merma]).toEqual([0.5, 0.125]);
  });
  it("el rendimiento lleva cantidad y unidad juntas o ninguna", () => {
    expect(recetaSchema.safeParse({ ...r, rendimientoCantidad: 100 }).success).toBe(false);
    expect(recetaSchema.safeParse({ ...r, rendimientoUnidad: "g" }).success).toBe(false);
    expect(recetaSchema.safeParse({ ...r, rendimientoCantidad: 100, rendimientoUnidad: "g" }).success).toBe(true);
  });
  it("rechaza cantidad 0, porción 0 y merma negativa o mayor a 1000 %", () => {
    for (const mala of [{ cantidad: 0 }, { porcion: 0 }, { merma: -1 }, { merma: 1001 }])
      expect(recetaSchema.safeParse({ ...r, detalle: [{ ...linea, ...mala }] }).success).toBe(false);
  });
  it("rechaza detalle vacío e ingredientes repetidos", () => {
    expect(recetaSchema.safeParse({ ...r, detalle: [] }).success).toBe(false);
    expect(recetaSchema.safeParse({ ...r, detalle: [linea, linea] }).success).toBe(false);
    expect(recetaSchema.safeParse({ ...r, detalle: [linea, { ...linea, tipo: "subreceta" }] }).success).toBe(true);
  });
  it("las porciones admiten hasta 2 decimales y 999.999,99 como máximo (igual que el servidor)", () => {
    expect(recetaSchema.safeParse({ ...r, porciones: 1.234 }).success).toBe(false);
    expect(recetaSchema.safeParse({ ...r, porciones: "2,5" }).success).toBe(true);
    expect(recetaSchema.safeParse({ ...r, porciones: 999999.99 }).success).toBe(true);
    expect(recetaSchema.safeParse({ ...r, porciones: 1000000 }).success).toBe(false);
  });
  it("rechaza porciones 0 y nombre vacío", () => {
    expect(recetaSchema.safeParse({ ...r, porciones: 0 }).success).toBe(false);
    expect(recetaSchema.safeParse({ ...r, nombre: "  " }).success).toBe(false);
  });
});
