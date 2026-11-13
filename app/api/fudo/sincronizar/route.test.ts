import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const pedirSincronizacion = vi.fn();
const procesarTrabajoFudo = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/trabajo-fudo", () => ({
  pedirSincronizacion: (...a: unknown[]) => pedirSincronizacion(...a),
  procesarTrabajoFudo: (...a: unknown[]) => procesarTrabajoFudo(...a),
}));

import { GET, POST } from "./route";

const SECRETO = "s".repeat(32);
const pedir = (metodo: "GET" | "POST", auth?: string) =>
  new NextRequest("http://localhost:3000/api/fudo/sincronizar", { method: metodo, headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  pedirSincronizacion.mockReset().mockResolvedValue({});
  procesarTrabajoFudo.mockReset().mockResolvedValue({ ejecutado: true, resumen: { ventas: 4 } });
  vi.stubEnv("CRON_SECRET", SECRETO);
});
afterEach(() => vi.unstubAllEnvs());

describe("/api/fudo/sincronizar", () => {
  it("con el secreto correcto encola como «cron» y ejecuta el trabajo, por POST y por GET (los cron de Vercel llaman por GET)", async () => {
    for (const [metodo, nombre] of [[GET, "GET"], [POST, "POST"]] as const) {
      const r = await metodo(pedir(nombre, `Bearer ${SECRETO}`));
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ resumen: { ventas: 4 } });
    }
    expect(pedirSincronizacion).toHaveBeenCalledWith(null, "cron", false);
    expect(procesarTrabajoFudo).toHaveBeenCalledTimes(2);
  });

  it("si ya hay una sincronización corriendo bien responde 202 sin duplicarla", async () => {
    procesarTrabajoFudo.mockResolvedValue({ ejecutado: false });
    const r = await GET(pedir("GET", `Bearer ${SECRETO}`));
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ enSegundoPlano: true });
  });

  it("si no se pudo encolar responde 502 con el error y no ejecuta nada", async () => {
    pedirSincronizacion.mockResolvedValue({ error: "No se pudo encolar la sincronización" });
    const r = await GET(pedir("GET", `Bearer ${SECRETO}`));
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ error: "No se pudo encolar la sincronización" });
    expect(procesarTrabajoFudo).not.toHaveBeenCalled();
  });

  it("si el trabajo termina con error responde 502", async () => {
    procesarTrabajoFudo.mockResolvedValue({ ejecutado: true, error: "Fudo no responde" });
    expect((await POST(pedir("POST", `Bearer ${SECRETO}`))).status).toBe(502);
  });

  it("sin secreto o con uno incorrecto responde 401 y no toca Fudo; sin CRON_SECRET configurado, 503", async () => {
    for (const auth of [undefined, "Bearer otro", SECRETO]) {
      expect((await GET(pedir("GET", auth))).status).toBe(401);
      expect((await POST(pedir("POST", auth))).status).toBe(401);
    }
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(pedir("GET", `Bearer ${SECRETO}`))).status).toBe(503);
    expect(pedirSincronizacion).not.toHaveBeenCalled();
  });
});
