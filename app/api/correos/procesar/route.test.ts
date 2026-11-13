import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const procesarCola = vi.fn(async () => ({ enviados: 3, fallidos: 1 }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/correo", () => ({ procesarCola: (...a: unknown[]) => procesarCola(...(a as [])) }));

import { GET, POST } from "./route";

const SECRETO = "s".repeat(32);
const pedir = (metodo: "GET" | "POST", auth?: string) =>
  new NextRequest("http://localhost:3000/api/correos/procesar", { method: metodo, headers: auth ? { authorization: auth } : {} });

beforeEach(() => { procesarCola.mockClear(); vi.stubEnv("CRON_SECRET", SECRETO); });
afterEach(() => vi.unstubAllEnvs());

describe("/api/correos/procesar", () => {
  it("con el secreto correcto reintenta hasta 50 correos, por POST y por GET (los cron de Vercel llaman por GET)", async () => {
    for (const [metodo, nombre] of [[GET, "GET"], [POST, "POST"]] as const) {
      const r = await metodo(pedir(nombre, `Bearer ${SECRETO}`));
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ enviados: 3, fallidos: 1 });
    }
    expect(procesarCola).toHaveBeenCalledTimes(2);
    expect(procesarCola).toHaveBeenCalledWith(50);
  });

  it("sin secreto o con uno incorrecto responde 401 y no envía nada", async () => {
    for (const auth of [undefined, "Bearer otro", `Bearer ${SECRETO}x`, SECRETO]) {
      expect((await POST(pedir("POST", auth))).status).toBe(401);
      expect((await GET(pedir("GET", auth))).status).toBe(401);
    }
    expect(procesarCola).not.toHaveBeenCalled();
  });

  it("si CRON_SECRET no está configurado (o es corto) responde 503", async () => {
    vi.stubEnv("CRON_SECRET", "corto");
    expect((await GET(pedir("GET", "Bearer corto"))).status).toBe(503);
    expect(procesarCola).not.toHaveBeenCalled();
  });
});
