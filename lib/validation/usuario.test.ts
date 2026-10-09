import { describe, it, expect } from "vitest";
import { crearUsuarioSchema, editarUsuarioSchema } from "./usuario";
import { MSG_CORREO } from "./correo";

const base = { rut: "12345678-5", nombres: "Ana", apellidos: "Pérez", password: "clave-temporal-123", idRol: "2" };

describe("alta de usuario: correo", () => {
  it("rechaza formatos inválidos con el mensaje orientador", () => {
    for (const correo of ["", "a@b", "sin-arroba", "a b@c.cl", "a@b.", "a@@b.cl", ".a@b.cl"]) {
      const r = crearUsuarioSchema.safeParse({ ...base, correo });
      expect(r.success, JSON.stringify(correo)).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toBe(MSG_CORREO);
    }
  });
  it("acepta un correo válido y lo normaliza a minúsculas", () => {
    const r = crearUsuarioSchema.safeParse({ ...base, correo: "  Ana.Perez@Empresa.CL " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.correo).toBe("ana.perez@empresa.cl");
  });
  it("el correo es obligatorio (no se acepta vacío)", () => {
    expect(crearUsuarioSchema.safeParse({ ...base }).success).toBe(false);
  });
});

describe("edición de usuario", () => {
  const edicion = { id: "5", nombres: " Ana María ", apellidos: "Pérez", correo: "Ana@Empresa.cl", estado: "1" };
  it("acepta datos válidos, normaliza el correo y recorta los nombres", () => {
    const r = editarUsuarioSchema.safeParse(edicion);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ id: 5, nombres: "ANA MARÍA", apellidos: "PÉREZ", correo: "ana@empresa.cl", estado: 1 });
  });
  it("rechaza correos con formato inválido con el mensaje orientador", () => {
    for (const correo of ["", "a@b", "sin-arroba", "a@@b.cl"]) {
      const r = editarUsuarioSchema.safeParse({ ...edicion, correo });
      expect(r.success, JSON.stringify(correo)).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toBe(MSG_CORREO);
    }
  });
  it("exige nombres y apellidos", () => {
    expect(editarUsuarioSchema.safeParse({ ...edicion, nombres: "  " }).success).toBe(false);
    expect(editarUsuarioSchema.safeParse({ ...edicion, apellidos: "" }).success).toBe(false);
  });
  it("el estado solo puede ser 0 o 1", () => {
    expect(editarUsuarioSchema.safeParse({ ...edicion, estado: "0" }).success).toBe(true);
    for (const estado of ["2", "-1", "abc", ""]) expect(editarUsuarioSchema.safeParse({ ...edicion, estado }).success, estado).toBe(false);
  });
  it("el id debe ser un entero positivo", () => {
    for (const id of ["0", "-3", "abc", "1.5", ""]) expect(editarUsuarioSchema.safeParse({ ...edicion, id }).success, id).toBe(false);
  });
});
