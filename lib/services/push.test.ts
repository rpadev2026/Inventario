import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/supabase", () => ({ db: { rpc: (...a: unknown[]) => rpc(...a) }, nulo: null }));
vi.mock("web-push", () => ({ default: { sendNotification: (...a: unknown[]) => sendNotification(...a), setVapidDetails: (...a: unknown[]) => setVapidDetails(...a) } }));

import { notificarPushEnviada, notificarPushResuelta, pushConfigurado } from "./push";

const VAPID = { VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", VAPID_SUBJECT: "mailto:a@x.cl" };
const SUB = { Endpoint: "https://push.x/1", P256dh: "k", Auth: "a" };
const conVapid = () => { for (const [k, v] of Object.entries(VAPID)) vi.stubEnv(k, v); };
const cuerpoEnviado = () => JSON.parse(sendNotification.mock.calls[0][1] as string);

beforeEach(() => {
  rpc.mockReset(); sendNotification.mockReset(); setVapidDetails.mockReset(); vi.unstubAllEnvs();
  for (const k of Object.keys(VAPID)) vi.stubEnv(k, "");
});

describe("pushConfigurado", () => {
  it("exige las tres variables VAPID", () => {
    expect(pushConfigurado()).toBe(false);
    conVapid();
    expect(pushConfigurado()).toBe(true);
    vi.stubEnv("VAPID_SUBJECT", "");
    expect(pushConfigurado()).toBe(false);
  });
});

describe("notificarPushEnviada", () => {
  it("sin claves VAPID no consulta la base ni lanza", async () => {
    await expect(notificarPushEnviada(5, "ANA LOPEZ", "COCINA", "tok-1", 9)).resolves.toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("avisa a quien tiene solicitudes.gestionar (sin el propio solicitante) con la URL por token, nunca por id", async () => {
    conVapid();
    rpc.mockResolvedValueOnce({ data: [SUB], error: null });
    sendNotification.mockResolvedValue({});
    await notificarPushEnviada(5, "ANA LOPEZ", "COCINA", "tok-1", 9);
    expect(rpc).toHaveBeenCalledWith("suscripciones_push_permiso", { p_permiso: "solicitudes.gestionar", p_excluir: 9 });
    expect(sendNotification).toHaveBeenCalledOnce();
    expect(sendNotification.mock.calls[0][0]).toEqual({ endpoint: "https://push.x/1", keys: { p256dh: "k", auth: "a" } });
    expect(cuerpoEnviado()).toEqual({ titulo: "Nueva solicitud #5", cuerpo: "ANA LOPEZ envió una solicitud para COCINA.", url: "/solicitudes/tok-1", tag: "solicitud-tok-1" });
  });

  it("una suscripción vencida (410) se borra con quitar_suscripcion_push", async () => {
    conVapid();
    rpc.mockImplementation(async (fn: string) => (fn === "suscripciones_push_permiso" ? { data: [SUB], error: null } : { error: null }));
    sendNotification.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
    await notificarPushEnviada(5, "ANA", "COCINA", "tok-1", 9);
    expect(rpc).toHaveBeenCalledWith("quitar_suscripcion_push", { p_endpoint: "https://push.x/1" });
  });

  it("un error de la base no lanza", async () => {
    conVapid();
    rpc.mockResolvedValueOnce({ data: null, error: { message: "caída" } });
    await expect(notificarPushEnviada(5, "ANA", "COCINA", "tok-1", 9)).resolves.toBeUndefined();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("si la librería lanza al configurarse, no se propaga", async () => {
    conVapid();
    setVapidDetails.mockImplementation(() => { throw new Error("clave inválida"); });
    await expect(notificarPushEnviada(5, "ANA", "COCINA", "tok-1", 9)).resolves.toBeUndefined();
  });
});

describe("notificarPushResuelta", () => {
  it("avisa solo al solicitante, con el texto de aprobada", async () => {
    conVapid();
    rpc.mockResolvedValueOnce({ data: [SUB], error: null });
    sendNotification.mockResolvedValue({});
    await notificarPushResuelta(7, 3, "tok-2", true);
    expect(rpc).toHaveBeenCalledWith("suscripciones_push_usuarios", { p_usuarios: [3] });
    expect(cuerpoEnviado()).toEqual({ titulo: "Solicitud #7 aprobada", cuerpo: "Ya puede recepcionar los productos cuando lleguen.", url: "/solicitudes/tok-2", tag: "solicitud-tok-2" });
  });

  it("texto de rechazada", async () => {
    conVapid();
    rpc.mockResolvedValueOnce({ data: [SUB], error: null });
    sendNotification.mockResolvedValue({});
    await notificarPushResuelta(7, 3, "tok-2", false);
    expect(cuerpoEnviado()).toMatchObject({ titulo: "Solicitud #7 rechazada", url: "/solicitudes/tok-2" });
  });

  it("sin claves VAPID no hace nada", async () => {
    await notificarPushResuelta(7, 3, "tok-2", true);
    expect(rpc).not.toHaveBeenCalled();
  });
});
