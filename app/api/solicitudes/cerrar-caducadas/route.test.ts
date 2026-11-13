import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const cerrarCaducadas = vi.fn(async () => ({ cerradas: 2 }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/caducidad", () => ({ cerrarCaducadas: () => cerrarCaducadas() }));

import { GET, POST } from "./route";

const SECRETO = "s".repeat(32);
const pedir = (metodo: "GET" | "POST", auth?: string) =>
  new NextRequest("http://localhost:3000/api/solicitudes/cerrar-caducadas", { method: metodo, headers: auth ? { authorization: auth } : {} });

beforeEach(() => { cerrarCaducadas.mockClear(); vi.stubEnv("CRON_SECRET", SECRETO); });
afterEach(() => vi.unstubAllEnvs());

describe("/api/solicitudes/cerrar-caducadas", () => {
  it("con el secreto correcto cierra las caducadas, por POST y por GET (los cron de Vercel llaman por GET)", async () => {
    for (const metodo of [GET, POST]) {
      const r = await metodo(pedir(metodo === GET ? "GET" : "POST", `Bearer ${SECRETO}`));
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ cerradas: 2 });
    }
    expect(cerrarCaducadas).toHaveBeenCalledTimes(2);
  });

  it("sin secreto o con uno incorrecto responde 401 y no cierra nada", async () => {
    for (const auth of [undefined, "Bearer otro", `Bearer ${SECRETO}x`, SECRETO]) {
      expect((await POST(pedir("POST", auth))).status).toBe(401);
      expect((await GET(pedir("GET", auth))).status).toBe(401);
    }
    expect(cerrarCaducadas).not.toHaveBeenCalled();
  });

  it("si CRON_SECRET no está configurado (o es corto) responde 503", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(pedir("POST", `Bearer ${SECRETO}`))).status).toBe(503);
    expect(cerrarCaducadas).not.toHaveBeenCalled();
  });
});
