import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const requerirPermiso = vi.fn(async () => ({ uid: 3 }));
const requerirAdmin = vi.fn(async () => ({ uid: 1 }));
const notificarParcial = vi.fn(async () => {});
const notificarResuelta = vi.fn(async () => {});
const notificarPushParcial = vi.fn(async () => {});
const notificarPushResuelta = vi.fn(async () => {});
const avisarCierre = vi.fn(async () => {});
let propiaDe: number | null = 7; // IdUsuarioSolicitante de la solicitud
const SOL = { NumeroSolicitud: 12, Token: "tok-12", IdUsuarioSolicitante: 7, Usuarios: { Correo: "beto@x.cl" } };
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: (f: () => unknown) => { void f(); } }));
vi.mock("@/lib/auth/session", () => ({ requerirPermiso: (...a: unknown[]) => requerirPermiso(...(a as [])), requerirAdmin: () => requerirAdmin() }));
vi.mock("@/lib/services/correo", () => ({
  notificarEnviada: vi.fn(), notificarResuelta: (...a: unknown[]) => notificarResuelta(...(a as [])), notificarParcial: (...a: unknown[]) => notificarParcial(...(a as [])),
}));
vi.mock("@/lib/services/push", () => ({
  notificarPushEnviada: vi.fn(), notificarPushRecepcionada: vi.fn(),
  notificarPushResuelta: (...a: unknown[]) => notificarPushResuelta(...(a as [])), notificarPushParcial: (...a: unknown[]) => notificarPushParcial(...(a as [])),
}));
vi.mock("@/lib/services/cierre", () => ({ avisarCierre: (...a: unknown[]) => avisarCierre(...(a as [])) }));
vi.mock("@/lib/db/supabase", () => ({
  db: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: propiaDe === null ? null : { IdUsuarioSolicitante: propiaDe } }), single: async () => ({ data: SOL }) };
      return q;
    },
  },
}));

import { aprobarParcialSolicitud, reaprobarSolicitud, cerrarSolicitud } from "./actions";

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const entrada = (motivo: unknown = "Falta stock") => ({ id: 5, items: [{ producto: 1, cantidad: 40 }], motivo });
const MSG_PARCIAL = "Indique el motivo de la aprobación parcial (máximo 100 caracteres)";
const MSG_CIERRE = "Indique el motivo del cierre (máximo 100 caracteres)";

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ error: null });
  for (const m of [requerirPermiso, requerirAdmin, notificarParcial, notificarResuelta, notificarPushParcial, notificarPushResuelta, avisarCierre]) m.mockClear();
  propiaDe = 7;
});

describe("aprobarParcialSolicitud", () => {
  it("exige el permiso de gestionar y llama al RPC con el motivo recortado", async () => {
    expect(await aprobarParcialSolicitud(entrada("  Falta stock  "))).toEqual({ ok: true });
    expect(requerirPermiso).toHaveBeenCalledWith("solicitudes.gestionar");
    expect(rpc).toHaveBeenCalledWith("aprobar_parcial_solicitud", { p_usuario: 3, p_solicitud: 5, p_items: [{ producto: 1, cantidad: 40 }], p_motivo: "Falta stock" });
  });

  it("avisa al solicitante (correo) y a solicitante y Administradores (push) con el motivo", async () => {
    await aprobarParcialSolicitud(entrada());
    expect(notificarParcial).toHaveBeenCalledWith(12, "beto@x.cl", "Falta stock");
    expect(notificarPushParcial).toHaveBeenCalledWith(12, 7, "tok-12", "Falta stock");
  });

  it("sin motivo (vacío, espacios, ausente o de 101 caracteres) no llama a la base", async () => {
    for (const m of ["", "   ", "x".repeat(101)]) expect(await aprobarParcialSolicitud(entrada(m))).toEqual({ error: MSG_PARCIAL });
    expect(await aprobarParcialSolicitud({ id: 5, items: [{ producto: 1, cantidad: 40 }] })).toEqual({ error: MSG_PARCIAL }); // ausente
    expect(rpc).not.toHaveBeenCalled();
    expect(notificarParcial).not.toHaveBeenCalled();
  });

  it("nadie aprueba parcialmente su propia solicitud", async () => {
    propiaDe = 3;
    expect(await aprobarParcialSolicitud(entrada())).toEqual({ error: "No puede aprobar su propia solicitud" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("un error de negocio de la base se muestra tal cual y no se avisa; uno crudo no se muestra", async () => {
    rpc.mockResolvedValue({ error: { code: "P0001", message: "No hay cantidades menores a las pedidas: use Aprobar" } });
    expect(await aprobarParcialSolicitud(entrada())).toEqual({ error: "No hay cantidades menores a las pedidas: use Aprobar" });
    expect(notificarPushParcial).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ error: { code: "XX000", message: 'relation "x" does not exist' } });
    expect((await aprobarParcialSolicitud(entrada())).error).toBe("No se pudo completar la operación");
  });
});

describe("reaprobarSolicitud (solo el rol Administrador)", () => {
  it("exige ser Administrador, llama al RPC y avisa como aprobada", async () => {
    expect(await reaprobarSolicitud({ id: 5 })).toEqual({ ok: true });
    expect(requerirAdmin).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("reaprobar_solicitud", { p_usuario: 1, p_solicitud: 5 });
    expect(notificarResuelta).toHaveBeenCalledWith(12, "beto@x.cl", true);
    expect(notificarPushResuelta).toHaveBeenCalledWith(12, 7, "tok-12", true);
  });

  it("si la sesión no es de Administrador, requerirAdmin lanza y no se toca nada", async () => {
    requerirAdmin.mockRejectedValueOnce(new Error("No autorizado"));
    await expect(reaprobarSolicitud({ id: 5 })).rejects.toThrow("No autorizado");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("id inválido y errores de la base", async () => {
    expect((await reaprobarSolicitud({ id: "abc" })).error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ error: { code: "P0001", message: "Stock insuficiente en Bodega Central para P1" } });
    expect(await reaprobarSolicitud({ id: 5 })).toEqual({ error: "Stock insuficiente en Bodega Central para P1" });
    expect(notificarResuelta).not.toHaveBeenCalled();
  });
});

describe("cerrarSolicitud (solo el rol Administrador)", () => {
  it("exige ser Administrador, llama al RPC con el motivo recortado y avisa a los participantes", async () => {
    expect(await cerrarSolicitud(undefined, fd({ id: "5", motivo: "  Ya no se necesita  " }))).toEqual({ ok: true });
    expect(requerirAdmin).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("cerrar_solicitud", { p_usuario: 1, p_solicitud: 5, p_motivo: "Ya no se necesita" });
    expect(avisarCierre).toHaveBeenCalledWith({ id: 5, numero: 12, token: "tok-12" }, "Ya no se necesita");
  });

  it("sin motivo no llama a la base", async () => {
    for (const motivo of ["", "   ", "x".repeat(101)]) expect(await cerrarSolicitud(undefined, fd({ id: "5", motivo }))).toEqual({ error: MSG_CIERRE });
    expect(await cerrarSolicitud(undefined, fd({ id: "5" }))).toEqual({ error: MSG_CIERRE });
    expect(rpc).not.toHaveBeenCalled();
    expect(avisarCierre).not.toHaveBeenCalled();
  });

  it("si no es Administrador no se cierra; un error de la base no avisa a nadie", async () => {
    requerirAdmin.mockRejectedValueOnce(new Error("No autorizado"));
    await expect(cerrarSolicitud(undefined, fd({ id: "5", motivo: "x" }))).rejects.toThrow("No autorizado");
    rpc.mockResolvedValue({ error: { code: "P0001", message: "La solicitud no está en estado Aprobada parcialmente" } });
    expect(await cerrarSolicitud(undefined, fd({ id: "5", motivo: "x" }))).toEqual({ error: "La solicitud no está en estado Aprobada parcialmente" });
    expect(avisarCierre).not.toHaveBeenCalled();
  });
});
