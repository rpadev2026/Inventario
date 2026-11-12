import { describe, it, expect } from "vitest";
import { conLimite, conTimeout, TiempoAgotado } from "./http-timeout";

/** fetch falso que respeta `signal`, como el real: se queda esperando hasta que lo abortan. */
const colgado: typeof fetch = (_i, init) =>
  new Promise((_, rechazar) => {
    init?.signal?.addEventListener("abort", () => rechazar(init.signal!.reason));
  });
const responde = (cuerpo: string): typeof fetch => async () => new Response(cuerpo);

describe("conTimeout", () => {
  it("una petición que no responde falla con TiempoAgotado y nombra el servicio", async () => {
    const t0 = Date.now();
    const r = conTimeout(colgado, 40, "Fudo")("https://x.test");
    await expect(r).rejects.toBeInstanceOf(TiempoAgotado);
    await expect(conTimeout(colgado, 40, "Fudo")("https://x.test")).rejects.toThrow("Fudo no respondió en 40 ms");
    expect(Date.now() - t0).toBeLessThan(1000);
  });
  it("si responde a tiempo, deja pasar la respuesta intacta", async () => {
    const r = await conTimeout(responde("hola"), 1000, "Fudo")("https://x.test");
    expect(await r.text()).toBe("hola");
  });
  it("los errores que no son de tiempo se propagan tal cual", async () => {
    const roto: typeof fetch = async () => { throw new TypeError("fetch failed"); };
    await expect(conTimeout(roto, 1000, "Fudo")("https://x.test")).rejects.toThrow("fetch failed");
  });
  it("si quien llama cancela con su propia signal, no se confunde con un tiempo agotado", async () => {
    const propio = new AbortController();
    const r = conTimeout(colgado, 5000, "Fudo")("https://x.test", { signal: propio.signal });
    propio.abort(new Error("cancelado por el usuario"));
    await expect(r).rejects.toThrow("cancelado por el usuario");
  });
  it("también corta una respuesta que se queda a medias al leer el cuerpo", async () => {
    const a_medias: typeof fetch = async (_i, init) => {
      const cuerpo = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("par")); init?.signal?.addEventListener("abort", () => c.error(init.signal!.reason)); } });
      return new Response(cuerpo);
    };
    const r = await conTimeout(a_medias, 40, "Bsale")("https://x.test");
    await expect(r.text()).rejects.toBeDefined();
  });
  it("manda la signal al fetch de verdad", async () => {
    let recibida: AbortSignal | null | undefined;
    await conTimeout(async (_i, init) => { recibida = init?.signal; return new Response(""); }, 1000, "X")("https://x.test");
    expect(recibida).toBeInstanceOf(AbortSignal);
  });
});

describe("conLimite", () => {
  it("devuelve el resultado si llega a tiempo", async () => expect(await conLimite(Promise.resolve(7), 1000, "Resend")).toBe(7));
  it("falla con TiempoAgotado si tarda más del límite", async () => {
    const lenta = new Promise<number>((res) => setTimeout(() => res(1), 500));
    await expect(conLimite(lenta, 30, "Resend")).rejects.toThrow("Resend no respondió en 30 ms");
  });
  it("propaga el error de la operación", async () => expect(conLimite(Promise.reject(new Error("boom")), 1000, "R")).rejects.toThrow("boom"));
});
