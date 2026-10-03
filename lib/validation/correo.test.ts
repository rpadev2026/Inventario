import { describe, it, expect } from "vitest";
import { esCorreoValido, MSG_CORREO } from "./correo";

describe("esCorreoValido", () => {
  it("acepta correos con formato usuario@dominio.ext", () => {
    for (const c of ["nombre@dominio.cl", "a.b-c_d+e@mail.example.com", "ventas@proveedor.co", "x@y.io", "JUAN.PEREZ@EMPRESA.CL", "n1@d2.org"])
      expect(esCorreoValido(c), c).toBe(true);
  });
  it("rechaza dominio sin punto o sin extensión", () => {
    for (const c of ["a@b", "a@b.", "a@.cl", "a@b.c", "a@@b.cl", "a@b..cl"]) expect(esCorreoValido(c), c).toBe(false);
  });
  it("rechaza texto sin arroba, sin usuario o con espacios", () => {
    for (const c of ["", "abc", "abc.cl", "@dominio.cl", "a b@dominio.cl", "a@do minio.cl", " a@b.cl ", "a@b.cl,c@d.cl", "a@b.cl;"])
      expect(esCorreoValido(c), JSON.stringify(c)).toBe(false);
  });
  it("rechaza puntos mal ubicados en el usuario", () => {
    for (const c of [".a@b.cl", "a.@b.cl", "a..b@c.cl"]) expect(esCorreoValido(c), c).toBe(false);
  });
  it("rechaza correos demasiado largos (máx. 254)", () => {
    expect(esCorreoValido("a".repeat(250) + "@b.cl")).toBe(false);
    expect(esCorreoValido("a".repeat(64) + "@b.cl")).toBe(true);
  });
  it("el mensaje orienta con un ejemplo", () => {
    expect(MSG_CORREO).toBe("Ingrese un correo válido, por ejemplo nombre@dominio.cl");
  });
});
