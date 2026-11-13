import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const notificarPushRecepcionada = vi.fn(async () => {});
const SOL = { NumeroSolicitud: 12, Token: "tok-12", IdUsuarioSolicitante: 7, Bodegas: { NombreBodega: "COCINA" }, Usuarios: { Nombres: "BETO", Apellidos: "SOLICITANTE" } };
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: (f: () => unknown) => { void f(); } }));
vi.mock("@/lib/auth/session", () => ({ requerirPermiso: async () => ({ uid: 7 }) }));
vi.mock("@/lib/services/correo", () => ({ notificarEnviada: vi.fn(), notificarResuelta: vi.fn() }));
vi.mock("@/lib/services/push", () => ({ notificarPushEnviada: vi.fn(), notificarPushResuelta: vi.fn(), notificarPushRecepcionada: (...a: unknown[]) => notificarPushRecepcionada(...(a as [])) }));
vi.mock("@/lib/db/supabase", () => ({
  db: { rpc: (...a: unknown[]) => rpc(...a), from: () => { const q = { select: () => q, eq: () => q, single: async () => ({ data: SOL }), maybeSingle: async () => ({ data: SOL }) }; return q; } },
}));

import { recepcionarSolicitud } from "./actions";
const entrada = { id: 5, items: [{ producto: 1, cantidad: 3 }] };

beforeEach(() => { rpc.mockReset(); notificarPushRecepcionada.mockClear(); });

describe("recepcionarSolicitud: aviso a quienes gestionan", () => {
  it("recepción total (el RPC devuelve estado 3): avisa como total", async () => {
    rpc.mockResolvedValue({ data: 3, error: null });
    expect(await recepcionarSolicitud(entrada)).toEqual({ ok: true });
    expect(notificarPushRecepcionada).toHaveBeenCalledWith(12, "BETO SOLICITANTE", "COCINA", "tok-12", 7, true);
  });

  it("recepción parcial (estado 4): avisa como parcial", async () => {
    rpc.mockResolvedValue({ data: 4, error: null });
    await recepcionarSolicitud(entrada);
    expect(notificarPushRecepcionada).toHaveBeenCalledWith(12, "BETO SOLICITANTE", "COCINA", "tok-12", 7, false);
  });

  it("si el RPC falla no se avisa y se devuelve el error de negocio", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "La solicitud no está en estado recepcionable" } });
    expect(await recepcionarSolicitud(entrada)).toEqual({ error: "La solicitud no está en estado recepcionable" });
    expect(notificarPushRecepcionada).not.toHaveBeenCalled();
  });

  it("entrada inválida (sin cantidades): no toca la base ni avisa", async () => {
    const r = await recepcionarSolicitud({ id: 5, items: [{ producto: 1, cantidad: 0 }] });
    expect(r.error).toBe("Indique al menos una cantidad recibida");
    expect(rpc).not.toHaveBeenCalled();
    expect(notificarPushRecepcionada).not.toHaveBeenCalled();
  });
});
