import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const notificarResuelta = vi.fn(async () => {});
const notificarPushResuelta = vi.fn(async () => {});
let propiaDe: number | null = 7; // IdUsuarioSolicitante de la solicitud (o null = no existe)
const SOLICITUD = { NumeroSolicitud: 12, Token: "tok-12", IdUsuarioSolicitante: 7, Usuarios: { Correo: "beto@x.cl" } };
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: (f: () => unknown) => { void f(); } }));
vi.mock("@/lib/auth/session", () => ({ requerirPermiso: async () => ({ uid: 3 }) }));
vi.mock("@/lib/services/correo", () => ({ notificarEnviada: vi.fn(), notificarResuelta: (...a: unknown[]) => notificarResuelta(...(a as [])) }));
vi.mock("@/lib/services/push", () => ({ notificarPushEnviada: vi.fn(), notificarPushResuelta: (...a: unknown[]) => notificarPushResuelta(...(a as [])), notificarPushRecepcionada: vi.fn() }));
vi.mock("@/lib/db/supabase", () => ({
  db: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: propiaDe === null ? null : { IdUsuarioSolicitante: propiaDe } }), single: async () => ({ data: SOLICITUD }) };
      return q;
    },
  },
}));

import { rechazarSolicitud } from "./actions";

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const MSG = "Indique el motivo del rechazo (máximo 100 caracteres)";

beforeEach(() => { rpc.mockReset().mockResolvedValue({ error: null }); notificarResuelta.mockClear(); notificarPushResuelta.mockClear(); propiaDe = 7; });

describe("rechazarSolicitud", () => {
  it("sin motivo no llama a la base y devuelve el error de negocio", async () => {
    for (const motivo of ["", "   ", "x".repeat(101)]) expect(await rechazarSolicitud(undefined, fd({ id: "5", motivo }))).toEqual({ error: MSG });
    expect(await rechazarSolicitud(undefined, fd({ id: "5" }))).toEqual({ error: MSG });
    expect(rpc).not.toHaveBeenCalled();
    expect(notificarResuelta).not.toHaveBeenCalled();
  });

  it("con motivo llama a rechazar_solicitud con el motivo recortado y avisa por correo y push con el motivo", async () => {
    expect(await rechazarSolicitud(undefined, fd({ id: "5", motivo: "  Sin stock  " }))).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("rechazar_solicitud", { p_usuario: 3, p_solicitud: 5, p_motivo: "Sin stock" });
    expect(notificarResuelta).toHaveBeenCalledWith(12, "beto@x.cl", false, "Sin stock");
    expect(notificarPushResuelta).toHaveBeenCalledWith(12, 7, "tok-12", false, "Sin stock");
  });

  it("no se puede rechazar la propia solicitud (mensaje de negocio, sin tocar la base)", async () => {
    propiaDe = 3;
    expect(await rechazarSolicitud(undefined, fd({ id: "5", motivo: "x" }))).toEqual({ error: "No puede rechazar su propia solicitud" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("un error de negocio de la base (P0001) se muestra tal cual y no se avisa a nadie", async () => {
    rpc.mockResolvedValue({ error: { code: "P0001", message: "Transición inválida de 2 a 5" } });
    expect(await rechazarSolicitud(undefined, fd({ id: "5", motivo: "x" }))).toEqual({ error: "Transición inválida de 2 a 5" });
    expect(notificarResuelta).not.toHaveBeenCalled();
    expect(notificarPushResuelta).not.toHaveBeenCalled();
  });

  it("un error crudo de la base no se muestra", async () => {
    rpc.mockResolvedValue({ error: { code: "XX000", message: 'relation "Solicitudes" does not exist' } });
    const r = await rechazarSolicitud(undefined, fd({ id: "5", motivo: "x" }));
    expect(r.error).toBe("No se pudo completar la operación");
  });

  it("un id inválido se rechaza sin tocar la base", async () => {
    const r = await rechazarSolicitud(undefined, fd({ id: "abc", motivo: "x" }));
    expect(r.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
});
