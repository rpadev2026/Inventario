import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const avisarCierre = vi.fn(async () => {});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/supabase", () => ({ db: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("./cierre", () => ({ avisarCierre: (...a: unknown[]) => avisarCierre(...(a as [])) }));

import { cerrarCaducadas } from "./caducidad";

beforeEach(() => { rpc.mockReset(); avisarCierre.mockClear(); });

describe("cerrarCaducadas", () => {
  it("sin solicitudes vencidas no avisa a nadie", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await cerrarCaducadas()).toEqual({ cerradas: 0 });
    expect(rpc).toHaveBeenCalledWith("cerrar_solicitudes_caducadas");
    expect(avisarCierre).not.toHaveBeenCalled();
  });

  it("por cada solicitud cerrada avisa a sus participantes con el motivo de caducidad", async () => {
    rpc.mockResolvedValue({ data: [{ IdSolicitud: 5, Token: "tok-5", NumeroSolicitud: 105 }, { IdSolicitud: 6, Token: "tok-6", NumeroSolicitud: 106 }], error: null });
    expect(await cerrarCaducadas()).toEqual({ cerradas: 2 });
    expect(avisarCierre).toHaveBeenCalledTimes(2);
    expect(avisarCierre).toHaveBeenCalledWith({ id: 5, numero: 105, token: "tok-5" }, "Cierre por caducidad de días");
    expect(avisarCierre).toHaveBeenCalledWith({ id: 6, numero: 106, token: "tok-6" }, "Cierre por caducidad de días");
  });

  it("un error de la base no lanza y no avisa", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "caída" } });
    expect(await cerrarCaducadas()).toEqual({ cerradas: 0 });
    expect(avisarCierre).not.toHaveBeenCalled();
  });

  it("si el aviso de una solicitud falla, las demás se avisan igual", async () => {
    rpc.mockResolvedValue({ data: [{ IdSolicitud: 5, Token: "t5", NumeroSolicitud: 105 }, { IdSolicitud: 6, Token: "t6", NumeroSolicitud: 106 }], error: null });
    avisarCierre.mockRejectedValueOnce(new Error("sin red"));
    expect(await cerrarCaducadas()).toEqual({ cerradas: 2 });
    expect(avisarCierre).toHaveBeenCalledTimes(2);
  });
});
