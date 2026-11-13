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

describe("public/sw.js: comportamiento con un `self` falso", () => {
  const codigo = readFileSync(join(__dirname, "..", "public", "sw.js"), "utf8");
  function cargar(ventanas: Array<{ focus: () => Promise<void>; navigate: (u: string) => Promise<void> }> = []) {
    const manejadores: Record<string, (e: any) => void> = {};
    const mostradas: Array<[string, any]> = [];
    const abiertas: string[] = [];
    const reclamado = { n: 0 };
    const self = {
      addEventListener: (n: string, f: (e: any) => void) => { manejadores[n] = f; },
      registration: { showNotification: async (t: string, o: any) => { mostradas.push([t, o]); } },
      clients: { matchAll: async () => ventanas, openWindow: async (u: string) => { abiertas.push(u); }, claim: async () => { reclamado.n++; } },
    };
    new Function("self", codigo)(self);
    const esperar = async (e: any) => { const ps: Promise<unknown>[] = []; e.waitUntil = (p: Promise<unknown>) => ps.push(p); return ps; };
    return { manejadores, mostradas, abiertas, esperar, reclamado };
  }

  it("al recibir un push muestra el título y el texto, con la ruta del aviso y su tag", async () => {
    const t = cargar();
    const e: any = { data: { json: () => ({ titulo: "Nueva solicitud #5", cuerpo: "ANA envió una solicitud para COCINA.", url: "/solicitudes/tok-1", tag: "solicitud-tok-1" }) } };
    const ps = await t.esperar(e); t.manejadores.push(e); await Promise.all(ps);
    expect(t.mostradas).toEqual([["Nueva solicitud #5", { body: "ANA envió una solicitud para COCINA.", tag: "solicitud-tok-1", data: { url: "/solicitudes/tok-1" } }]]);
  });

  it("un push sin datos o con datos inválidos igual muestra un aviso genérico y no revienta", async () => {
    for (const data of [null, { json: () => { throw new Error("no es json"); } }]) {
      const t = cargar();
      const e: any = { data };
      const ps = await t.esperar(e); t.manejadores.push(e); await Promise.all(ps);
      expect(t.mostradas[0][0]).toBe("Inventario del Restaurant");
      expect(t.mostradas[0][1].data.url).toBe("/");
    }
  });

  it("una URL externa en el aviso se reemplaza por el inicio", async () => {
    const t = cargar();
    const e: any = { data: { json: () => ({ titulo: "x", url: "https://evil.com/phish" }) } };
    const ps = await t.esperar(e); t.manejadores.push(e); await Promise.all(ps);
    expect(t.mostradas[0][1].data.url).toBe("/");
  });

  it("el clic cierra el aviso y, sin ventanas abiertas, abre la solicitud", async () => {
    const t = cargar();
    let cerrada = false;
    const e: any = { notification: { close: () => { cerrada = true; }, data: { url: "/solicitudes/tok-1" } } };
    const ps = await t.esperar(e); t.manejadores.notificationclick(e); await Promise.all(ps);
    expect(cerrada).toBe(true);
    expect(t.abiertas).toEqual(["/solicitudes/tok-1"]);
  });

  it("con una ventana ya abierta la enfoca y la lleva a la solicitud (no abre otra)", async () => {
    const hecho: string[] = [];
    const t = cargar([{ focus: async () => { hecho.push("focus"); }, navigate: async (u) => { hecho.push("navigate " + u); } }]);
    const e: any = { notification: { close: () => {}, data: { url: "/solicitudes/tok-2" } } };
    const ps = await t.esperar(e); t.manejadores.notificationclick(e); await Promise.all(ps);
    expect(hecho).toEqual(["focus", "navigate /solicitudes/tok-2"]);
    expect(t.abiertas).toEqual([]);
  });

  it("el clic en un aviso con URL externa abre el inicio", async () => {
    const t = cargar();
    const e: any = { notification: { close: () => {}, data: { url: "//evil.com" } } };
    const ps = await t.esperar(e); t.manejadores.notificationclick(e); await Promise.all(ps);
    expect(t.abiertas).toEqual(["/"]);
  });

  it("al activarse toma el control de las pestañas ya abiertas (si no, navigate() rechaza en ellas)", async () => {
    const t = cargar();
    const e: any = {};
    const ps = await t.esperar(e); t.manejadores.activate(e); await Promise.all(ps);
    expect(t.reclamado.n).toBe(1);
  });

  it("si navigate() falla en la ventana abierta, abre la solicitud en una ventana nueva en vez de quedarse sin navegar", async () => {
    const t = cargar([{ focus: async () => {}, navigate: async () => { throw new TypeError("no controlada"); } }]);
    const e: any = { notification: { close: () => {}, data: { url: "/solicitudes/tok-3" } } };
    const ps = await t.esperar(e); t.manejadores.notificationclick(e); await Promise.all(ps);
    expect(t.abiertas).toEqual(["/solicitudes/tok-3"]);
  });
});
