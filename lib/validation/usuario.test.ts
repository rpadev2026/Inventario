import { describe, it, expect } from "vitest";
import { crearUsuarioSchema } from "./usuario";
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
