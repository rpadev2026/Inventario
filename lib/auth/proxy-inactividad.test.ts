import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { jwtVerify, SignJWT } from "jose";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

/** proxy.ts con tokens reales: sesión deslizante y cierre por inactividad (SESSION_IDLE_MINUTES). */
const SECRETO = "s".repeat(40);
const clave = new TextEncoder().encode(SECRETO);
const AHORA = Date.UTC(2026, 10, 12, 21, 0, 0);

const token = (extra: Record<string, unknown>, iat = Math.floor(AHORA / 1000) - 60) =>
  new SignJWT({ roles: ["Administrador"], cambiar: false, v: 1, ...extra }).setProtectedHeader({ alg: "HS256" }).setSubject("1")
    .setIssuedAt(iat).setExpirationTime(iat + 8 * 3600).sign(clave);
const pedir = (t?: string, ruta = "/ventas-fudo") =>
  proxy(new NextRequest(`http://localhost:3000${ruta}`, { headers: t ? { cookie: `sesion=${t}` } : {} }));

beforeAll(() => { process.env.SESSION_SECRET = SECRETO; });
afterEach(() => { vi.useRealTimers(); delete process.env.SESSION_IDLE_MINUTES; });
const enHora = () => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(AHORA); };

describe("proxy: inactividad", () => {
  it("con actividad reciente deja pasar y no renueva dentro de los 10 s", async () => {
    process.env.SESSION_IDLE_MINUTES = "2"; enHora();
    const r = await pedir(await token({ la: AHORA - 5_000 }));
    expect(r.status).toBe(200);
    expect(r.headers.get("location")).toBeNull();
    expect(r.cookies.get("sesion")).toBeUndefined();
  });

  it("pasados 10 s renueva la marca de actividad sin cambiar quién es ni el vencimiento", async () => {
    process.env.SESSION_IDLE_MINUTES = "2"; enHora();
    const original = await token({ la: AHORA - 90_000 });
    const r = await pedir(original);
    const nueva = r.cookies.get("sesion")?.value;
    expect(r.status).toBe(200);
    expect(nueva).toBeTruthy();
    const a = (await jwtVerify(original, clave)).payload, b = (await jwtVerify(nueva!, clave)).payload;
    expect(b.la).toBe(AHORA);
    expect({ sub: b.sub, v: b.v, roles: b.roles, exp: b.exp, iat: b.iat }).toEqual({ sub: a.sub, v: a.v, roles: a.roles, exp: a.exp, iat: a.iat });
  });

  it("con más de SESSION_IDLE_MINUTES sin actividad redirige al ingreso y borra la sesión", async () => {
    process.env.SESSION_IDLE_MINUTES = "2"; enHora();
    const r = await pedir(await token({ la: AHORA - 121_000 }));
    expect(r.status).toBe(307);
    expect(new URL(r.headers.get("location")!).pathname + new URL(r.headers.get("location")!).search).toBe("/login?cierre=inactividad");
    expect(r.cookies.get("sesion")?.value).toBe("");
  });

  it("una sesión abierta desde las 18:00 (token antiguo, sin marca) se cierra a las 21:45", async () => {
    process.env.SESSION_IDLE_MINUTES = "2"; enHora();
    const iat18 = Math.floor((AHORA - 3.75 * 3600_000) / 1000); // 17:15 UTC del mismo día; cuenta desde que se emitió
    const r = await pedir(await token({}, iat18));
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toContain("/login?cierre=inactividad");
  });

  it("el límite sale de la variable: con 30 minutos la misma sesión de hace 10 minutos sigue válida", async () => {
    process.env.SESSION_IDLE_MINUTES = "30"; enHora();
    expect((await pedir(await token({ la: AHORA - 600_000 }))).status).toBe(200);
  });

  it("sin la variable usa 30 minutos", async () => {
    enHora();
    expect((await pedir(await token({ la: AHORA - 29 * 60_000 }))).status).toBe(200);
    expect((await pedir(await token({ la: AHORA - 31 * 60_000 }))).status).toBe(307);
  });

  it("sin sesión sigue redirigiendo al ingreso sin el aviso de inactividad", async () => {
    const r = await pedir(undefined);
    expect(r.status).toBe(307);
    expect(new URL(r.headers.get("location")!).search).toBe("");
  });

  it("el ingreso y el cron siguen siendo públicos", async () => {
    expect((await pedir(undefined, "/login")).status).toBe(200);
    expect((await pedir(undefined, "/api/fudo/sincronizar")).status).toBe(200);
  });
});
