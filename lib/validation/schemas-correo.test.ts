import { describe, it, expect } from "vitest";
import { proveedorSchema, sucursalSchema, vendedorSchema } from "./schemas";
import { MSG_CORREO } from "./correo";

const proveedor = { rut: "76086428-5", razonSocial: "Prov SA" };
const sucursal = { direccion: "Av. 1" };
const vendedor = { rut: "12345678-5", nombres: "Ana", apellidos: "Pérez" };

describe("correo en los formularios de Proveedores", () => {
  const casos = [["proveedor", proveedorSchema, proveedor], ["sucursal", sucursalSchema, sucursal], ["vendedor", vendedorSchema, vendedor]] as const;
  for (const [nombre, schema, base] of casos) {
    it(`${nombre}: rechaza formatos inválidos con el mensaje orientador`, () => {
      for (const correo of ["a@b", "sin-arroba", "a b@c.cl", "a@b.", "a@@b.cl"]) {
        const r = schema.safeParse({ ...base, correo });
        expect(r.success, correo).toBe(false);
        if (!r.success) expect(r.error.issues[0].message).toBe(MSG_CORREO);
      }
    });
    it(`${nombre}: acepta un correo válido (normalizado a minúsculas) y también vacío`, () => {
      const ok = schema.safeParse({ ...base, correo: "  Contacto@Empresa.CL " });
      expect(ok.success).toBe(true);
      if (ok.success) expect((ok.data as { correo: string | null }).correo).toBe("contacto@empresa.cl");
      const vacio = schema.safeParse({ ...base, correo: "" });
      expect(vacio.success).toBe(true);
      if (vacio.success) expect((vacio.data as { correo: string | null }).correo).toBeNull();
    });
  }
});
