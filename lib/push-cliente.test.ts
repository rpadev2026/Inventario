import { describe, it, expect } from "vitest";
import { vi } from "vitest";
import { claveAplicacion, estadoAvisos, reasignarSuscripcion } from "./push-cliente";

describe("claveAplicacion", () => {
  it("decodifica base64url con y sin relleno a los mismos bytes", () => {
    // "hola" = aG9sYQ== ; en base64url sin relleno: aG9sYQ
    expect(Array.from(claveAplicacion("aG9sYQ"))).toEqual([104, 111, 108, 97]);
    expect(Array.from(claveAplicacion("aG9sYQ=="))).toEqual([104, 111, 108, 97]);
  });
  it("traduce los caracteres propios de base64url (- y _)", () => {
    expect(Array.from(claveAplicacion("-_8"))).toEqual([251, 255]); // "+/8=" en base64 estándar
  });
});

const base = { soportado: true, esIos: false, instalada: false, permiso: "default" as const, configurado: true, suscrito: false };
describe("estadoAvisos", () => {
  it("navegador sin soporte", () => expect(estadoAvisos({ ...base, soportado: false })).toBe("no-soportado"));
  it("iPhone con la app sin instalar: no hay push hasta instalarla", () => {
    expect(estadoAvisos({ ...base, soportado: false, esIos: true, instalada: false })).toBe("ios-sin-instalar");
    expect(estadoAvisos({ ...base, esIos: true, instalada: false })).toBe("ios-sin-instalar");
  });
  it("iPhone con la app instalada funciona como los demás", () => expect(estadoAvisos({ ...base, esIos: true, instalada: true })).toBe("inactivo"));
  it("sin claves VAPID en el servidor", () => expect(estadoAvisos({ ...base, configurado: false })).toBe("sin-configurar"));
  it("permiso denegado en el navegador", () => expect(estadoAvisos({ ...base, permiso: "denied" })).toBe("bloqueado"));
  it("activo solo con permiso concedido y suscripción", () => {
    expect(estadoAvisos({ ...base, permiso: "granted", suscrito: true })).toBe("activo");
    expect(estadoAvisos({ ...base, permiso: "granted", suscrito: false })).toBe("inactivo");
  });
  it("ordena: no soportado/iOS primero, luego sin configurar, luego bloqueado", () => {
    expect(estadoAvisos({ ...base, configurado: false, permiso: "denied" })).toBe("sin-configurar");
  });
});

describe("reasignarSuscripcion", () => {
  const sub = { toJSON: () => ({ endpoint: "https://push.x/1", keys: { p256dh: "k", auth: "a" } }) };
  it("con una suscripción del navegador la vuelve a guardar para el usuario de la sesión (dispositivo compartido)", async () => {
    const guardar = vi.fn(async () => ({ ok: true as const }));
    expect(await reasignarSuscripcion(sub, guardar)).toBe(true);
    expect(guardar).toHaveBeenCalledWith({ endpoint: "https://push.x/1", p256dh: "k", auth: "a" });
  });
  it("sin suscripción no llama al servidor", async () => {
    const guardar = vi.fn(async () => ({ ok: true as const }));
    expect(await reasignarSuscripcion(null, guardar)).toBe(false);
    expect(guardar).not.toHaveBeenCalled();
  });
  it("si el servidor rechaza o lanza, devuelve false y no propaga", async () => {
    expect(await reasignarSuscripcion(sub, async () => ({ error: "x" }))).toBe(false);
    expect(await reasignarSuscripcion(sub, async () => { throw new Error("red"); })).toBe(false);
  });
});
