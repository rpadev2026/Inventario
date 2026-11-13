import { describe, it, expect, vi } from "vitest";
import { enviarAvisos, type Suscripcion, type AvisoPush } from "./cola-push";

const aviso: AvisoPush = { titulo: "Nueva solicitud #5", cuerpo: "Ana envió una solicitud", url: "/solicitudes/t-1", tag: "solicitud-t-1" };
const sub = (n: number): Suscripcion => ({ endpoint: `https://push.x/${n}`, p256dh: "k", auth: "a" });
const falla = (statusCode?: number) => Object.assign(new Error("falló"), statusCode === undefined ? {} : { statusCode });

describe("enviarAvisos", () => {
  it("envía a todas las suscripciones", async () => {
    const enviar = vi.fn(async () => {});
    const quitar = vi.fn(async () => {});
    expect(await enviarAvisos([sub(1), sub(2), sub(3)], aviso, enviar, quitar)).toEqual({ enviados: 3, quitadas: 0, fallidos: 0 });
    expect(enviar).toHaveBeenCalledTimes(3);
    expect(enviar).toHaveBeenCalledWith(sub(2), aviso);
    expect(quitar).not.toHaveBeenCalled();
  });

  it("una suscripción vencida (410) se borra y las demás igual reciben el aviso", async () => {
    const enviar = vi.fn(async (s: Suscripcion) => { if (s.endpoint.endsWith("/2")) throw falla(410); });
    const quitar = vi.fn(async () => {});
    expect(await enviarAvisos([sub(1), sub(2), sub(3)], aviso, enviar, quitar)).toEqual({ enviados: 2, quitadas: 1, fallidos: 0 });
    expect(quitar).toHaveBeenCalledOnce();
    expect(quitar).toHaveBeenCalledWith("https://push.x/2");
  });

  it("404 también se borra", async () => {
    const quitar = vi.fn(async () => {});
    const r = await enviarAvisos([sub(1)], aviso, async () => { throw falla(404); }, quitar);
    expect(r).toEqual({ enviados: 0, quitadas: 1, fallidos: 0 });
  });

  it("un error del servicio de push (500) o de red cuenta como fallido y NO borra la suscripción", async () => {
    const quitar = vi.fn(async () => {});
    const r = await enviarAvisos([sub(1), sub(2)], aviso, async (s) => { throw s.endpoint.endsWith("/1") ? falla(500) : falla(); }, quitar);
    expect(r).toEqual({ enviados: 0, quitadas: 0, fallidos: 2 });
    expect(quitar).not.toHaveBeenCalled();
  });

  it("si borrar la suscripción falla, no se propaga el error", async () => {
    const r = await enviarAvisos([sub(1), sub(2)], aviso, async (s) => { if (s.endpoint.endsWith("/1")) throw falla(410); }, async () => { throw new Error("base caída"); });
    expect(r).toEqual({ enviados: 1, quitadas: 0, fallidos: 1 });
  });

  it("sin suscripciones no llama al enviador", async () => {
    const enviar = vi.fn(async () => {});
    expect(await enviarAvisos([], aviso, enviar, async () => {})).toEqual({ enviados: 0, quitadas: 0, fallidos: 0 });
    expect(enviar).not.toHaveBeenCalled();
  });
});
