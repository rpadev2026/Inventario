import { describe, it, expect } from "vitest";
import { motivoRechazoSchema, motivoSchema, MSG_MOTIVO_CIERRE, MSG_MOTIVO_PARCIAL, MSG_MOTIVO_RECHAZO } from "./motivo-rechazo";

describe("motivoRechazoSchema", () => {
  it("acepta de 1 a 100 caracteres y recorta los extremos", () => {
    expect(motivoRechazoSchema.parse("  Sin stock  ")).toBe("Sin stock");
    expect(motivoRechazoSchema.parse("a")).toBe("a");
    expect(motivoRechazoSchema.parse("a".repeat(100))).toHaveLength(100);
  });
  it("rechaza vacío, solo espacios o saltos de línea, ausente y más de 100", () => {
    for (const malo of ["", "   ", "\t\n", undefined, null, "a".repeat(101), `  ${"a".repeat(101)}  `]) {
      const r = motivoRechazoSchema.safeParse(malo);
      expect(r.success, String(malo)).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toBe(MSG_MOTIVO_RECHAZO);
    }
  });
  it("el mensaje es el de negocio", () => expect(MSG_MOTIVO_RECHAZO).toBe("Indique el motivo del rechazo (máximo 100 caracteres)"));
});

describe("motivoSchema (motivos de aprobación parcial y de cierre)", () => {
  it("mismos límites con mensajes propios", () => {
    expect(MSG_MOTIVO_PARCIAL).toBe("Indique el motivo de la aprobación parcial (máximo 100 caracteres)");
    expect(MSG_MOTIVO_CIERRE).toBe("Indique el motivo del cierre (máximo 100 caracteres)");
    for (const msg of [MSG_MOTIVO_PARCIAL, MSG_MOTIVO_CIERRE]) {
      const esquema = motivoSchema(msg);
      expect(esquema.parse("  Falta stock  ")).toBe("Falta stock");
      expect(esquema.parse("a".repeat(100))).toHaveLength(100);
      for (const malo of ["", "   ", "\t\n", undefined, null, "a".repeat(101)]) {
        const r = esquema.safeParse(malo);
        expect(r.success, String(malo)).toBe(false);
        if (!r.success) expect(r.error.issues[0].message).toBe(msg);
      }
    }
  });
});
