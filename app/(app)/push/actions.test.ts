import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const requerirPermiso = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/supabase", () => ({ db: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("@/lib/auth/session", () => ({ requerirPermiso: (...a: unknown[]) => requerirPermiso(...a) }));

import { suscribirPush, desuscribirPush } from "./actions";

const valida = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: "BKey", auth: "authKey" };

beforeEach(() => { rpc.mockReset().mockResolvedValue({ error: null }); requerirPermiso.mockReset().mockResolvedValue({ uid: 4 }); });

describe("suscribirPush", () => {
  it("exige permiso de ver solicitudes propias o gestionarlas y guarda con el usuario de la sesión", async () => {
    expect(await suscribirPush(valida)).toEqual({ ok: true });
    expect(requerirPermiso).toHaveBeenCalledWith("solicitudes.ver_propias", "solicitudes.gestionar");
    expect(rpc).toHaveBeenCalledWith("guardar_suscripcion_push", { p_usuario: 4, p_endpoint: valida.endpoint, p_p256dh: "BKey", p_auth: "authKey" });
  });

  it("rechaza entradas inválidas con un mensaje de negocio y sin tocar la base", async () => {
    for (const mala of [null, {}, { ...valida, endpoint: "http://inseguro.x/1" }, { ...valida, endpoint: "" }, { ...valida, p256dh: "" }, { ...valida, auth: "" }, { ...valida, endpoint: "x".repeat(3000) }]) {
      const r = await suscribirPush(mala);
      expect(r.error).toBeTruthy();
      expect(r.ok).toBeUndefined();
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("un error de la base no se muestra crudo", async () => {
    rpc.mockResolvedValue({ error: { message: "duplicate key value violates unique constraint", code: "23505" } });
    const r = await suscribirPush(valida);
    expect(r.error).toBe("No se pudo activar los avisos. Intente nuevamente.");
  });
});

describe("desuscribirPush", () => {
  it("quita el endpoint", async () => {
    expect(await desuscribirPush({ endpoint: valida.endpoint })).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("quitar_suscripcion_push", { p_endpoint: valida.endpoint });
  });
  it("entrada inválida", async () => {
    expect((await desuscribirPush({})).error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
});
