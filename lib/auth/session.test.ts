import { describe, it, expect, vi, beforeEach } from "vitest";
import { decodeJwt } from "jose";

// Dependencias del servidor simuladas: la cookie capturada y una "base" con la versión de sesión actual.
const cookiesSet: { nombre: string; valor: string }[] = [];
const cookiesBorradas: string[] = [];
const rpc = vi.fn();
let versionEnBd = 1;

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (nombre: string, valor: string) => cookiesSet.push({ nombre, valor }),
    delete: (nombre: string) => cookiesBorradas.push(nombre),
    get: () => undefined,
  }),
}));
vi.mock("@/lib/db/supabase", () => ({
  db: {
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { VersionSesion: versionEnBd } }) }) }) }),
    rpc,
  },
}));

process.env.SESSION_SECRET = "x".repeat(40);
const { crearSesion } = await import("./session");

beforeEach(() => { cookiesSet.length = 0; cookiesBorradas.length = 0; rpc.mockReset(); versionEnBd = 1; });

const datos = { uid: 7, roles: ["Compras"], cambiar: false };
const claim = () => decodeJwt(cookiesSet[0].valor).v;

describe("crearSesion: versión de sesión del token", () => {
  // Regresión (auditoría de seguridad): al ingresar se releía la versión; si la clave cambiaba entre verificar el hash y firmar,
  // el token salía con la versión nueva habiendo probado solo la clave anterior.
  it("con la versión de la fila verificada firma esa, aunque en la base ya sea otra (un cambio de clave concurrente)", async () => {
    versionEnBd = 2; // alguien cambió la clave después de verificar el hash
    await crearSesion(datos, 1);
    expect(claim()).toBe(1); // el token queda con la versión vieja: leerSesion lo rechazará contra la versión 2
  });
  it("sin versión explícita (tras cambiar la clave) lee la vigente", async () => {
    versionEnBd = 5;
    await crearSesion(datos);
    expect(claim()).toBe(5);
  });
  it("la versión 0 explícita se respeta (no cae a la lectura)", async () => {
    versionEnBd = 9;
    await crearSesion(datos, 0);
    expect(claim()).toBe(0);
  });
});
