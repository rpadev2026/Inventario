import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rutaInterna } from "./push-url";

describe("rutaInterna", () => {
  it("acepta rutas internas", () => {
    expect(rutaInterna("/solicitudes/3a8c9632-90ee-452b-9fd1-d4098ec2bf41")).toBe("/solicitudes/3a8c9632-90ee-452b-9fd1-d4098ec2bf41");
    expect(rutaInterna("/")).toBe("/");
  });
  it("todo lo demás va al inicio: otro sitio, esquema, ruta relativa al protocolo, barra invertida o no-texto", () => {
    for (const mala of ["//evil.com", "https://evil.com/x", "javascript:alert(1)", "/\\evil.com", "solicitudes/1", "", null, undefined, 5, {}])
      expect(rutaInterna(mala)).toBe("/");
  });
});

describe("public/sw.js", () => {
  const sw = readFileSync(join(__dirname, "..", "public", "sw.js"), "utf8");
  it("muestra el aviso al recibir un push y abre solo rutas internas al hacer clic", () => {
    expect(sw).toContain('addEventListener("push"');
    expect(sw).toContain("showNotification");
    expect(sw).toContain('addEventListener("notificationclick"');
    expect(sw).toContain("function rutaInterna");
    expect(sw).toContain("openWindow(rutaInterna(");
    expect(sw).not.toMatch(/openWindow\((?!rutaInterna)/); // nunca abre una URL sin validar
  });
  it("su regla de rutaInterna es la misma que la de lib/push-url.ts", () => {
    const f = new Function(`${sw.match(/function rutaInterna[\s\S]*?\n}\n/)![0]}; return rutaInterna;`)() as (u: unknown) => string;
    for (const u of ["/solicitudes/x", "//evil.com", "https://x", "/\\x", "", null, 5]) expect(f(u)).toBe(rutaInterna(u));
  });
});
