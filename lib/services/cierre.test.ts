import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const notificarCierre = vi.fn(async () => {});
const notificarPushCierre = vi.fn(async () => {});
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (f: () => unknown) => { void f(); } }));
vi.mock("@/lib/db/supabase", () => ({ db: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("./correo", () => ({ notificarCierre: (...a: unknown[]) => notificarCierre(...(a as [])) }));
vi.mock("./push", () => ({ notificarPushCierre: (...a: unknown[]) => notificarPushCierre(...(a as [])) }));

import { avisarCierre } from "./cierre";

const SOL = { id: 5, numero: 12, token: "tok-12" };
beforeEach(() => { rpc.mockReset(); notificarCierre.mockClear(); notificarPushCierre.mockClear(); });

describe("avisarCierre", () => {
  it("busca a los participantes y les avisa por correo (todos en un envío) y por push", async () => {
    rpc.mockResolvedValue({ data: [{ IdUsuario: 1, Correo: "a@x.cl" }, { IdUsuario: 2, Correo: "b@x.cl" }], error: null });
    await avisarCierre(SOL, "Cierre por caducidad de días");
    expect(rpc).toHaveBeenCalledWith("participantes_solicitud", { p_solicitud: 5 });
    expect(notificarCierre).toHaveBeenCalledWith(12, ["a@x.cl", "b@x.cl"], "Cierre por caducidad de días");
    expect(notificarPushCierre).toHaveBeenCalledWith(12, "tok-12", "Cierre por caducidad de días", [1, 2]);
  });

  it("un error de la base no lanza y no avisa a nadie", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "caída" } });
    await expect(avisarCierre(SOL, "x")).resolves.toBeUndefined();
    expect(notificarCierre).not.toHaveBeenCalled();
    expect(notificarPushCierre).not.toHaveBeenCalled();
  });

  it("un fallo del correo no impide el push, y viceversa", async () => {
    rpc.mockResolvedValue({ data: [{ IdUsuario: 1, Correo: "a@x.cl" }], error: null });
    notificarCierre.mockRejectedValueOnce(new Error("sin red"));
    await expect(avisarCierre(SOL, "x")).resolves.toBeUndefined();
    expect(notificarPushCierre).toHaveBeenCalled();
  });
});
