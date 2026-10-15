import { describe, it, expect, vi } from "vitest";
import { procesarColaCon, type ColaCorreos, type CorreoPendiente, type Enviador } from "./cola-correos";

const correo = (id: number, intentos = 1): CorreoPendiente => ({ id, para: [`u${id}@x.cl`], asunto: `Asunto ${id}`, html: "<p>h</p>", intentos });

/** Cola falsa en memoria: registra qué se pidió y cómo se resolvió cada correo. */
function colaFalsa(correos: CorreoPendiente[]) {
  const resueltos: { id: number; motivo: string | null }[] = [];
  const cola: ColaCorreos = {
    reclamar: vi.fn(async () => correos),
    resolver: vi.fn(async (id, motivo) => { resueltos.push({ id, motivo }); }),
  };
  return { cola, resueltos };
}

describe("procesarColaCon", () => {
  it("envía los correos reclamados y los marca como enviados", async () => {
    const { cola, resueltos } = colaFalsa([correo(1), correo(2)]);
    const enviar: Enviador = vi.fn(async () => null);
    expect(await procesarColaCon(cola, enviar)).toEqual({ enviados: 2, fallidos: 0 });
    expect(resueltos).toEqual([{ id: 1, motivo: null }, { id: 2, motivo: null }]);
    expect(enviar).toHaveBeenCalledTimes(2);
  });

  it("pide a la cola solo el máximo indicado (por defecto 20)", async () => {
    const { cola } = colaFalsa([]);
    await procesarColaCon(cola, async () => null, 5);
    expect(cola.reclamar).toHaveBeenCalledWith(5);
    await procesarColaCon(cola, async () => null);
    expect(cola.reclamar).toHaveBeenLastCalledWith(20);
  });

  it("un correo que falla se resuelve con su motivo y no detiene a los demás", async () => {
    const { cola, resueltos } = colaFalsa([correo(1), correo(2), correo(3)]);
    const enviar: Enviador = async (c) => (c.id === 2 ? "dominio no verificado" : null);
    expect(await procesarColaCon(cola, enviar)).toEqual({ enviados: 2, fallidos: 1 });
    expect(resueltos).toEqual([{ id: 1, motivo: null }, { id: 2, motivo: "dominio no verificado" }, { id: 3, motivo: null }]);
  });

  it("un enviador que lanza una excepción cuenta como fallo, con el mensaje de la excepción", async () => {
    const { cola, resueltos } = colaFalsa([correo(1), correo(2)]);
    const enviar: Enviador = async (c) => { if (c.id === 1) throw new Error("timeout de red"); return null; };
    expect(await procesarColaCon(cola, enviar)).toEqual({ enviados: 1, fallidos: 1 });
    expect(resueltos).toEqual([{ id: 1, motivo: "timeout de red" }, { id: 2, motivo: null }]);
  });

  it("sin correos vencidos no envía nada", async () => {
    const { cola } = colaFalsa([]);
    const enviar = vi.fn(async () => null);
    expect(await procesarColaCon(cola, enviar)).toEqual({ enviados: 0, fallidos: 0 });
    expect(enviar).not.toHaveBeenCalled();
  });

  it("si no se puede leer la cola no lanza ni envía nada", async () => {
    const cola: ColaCorreos = { reclamar: async () => { throw new Error("base caída"); }, resolver: async () => {} };
    const enviar = vi.fn(async () => null);
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await procesarColaCon(cola, enviar)).toEqual({ enviados: 0, fallidos: 0 });
    expect(enviar).not.toHaveBeenCalled();
    expect(registro).toHaveBeenCalled();
    registro.mockRestore();
  });

  it("si no se puede registrar el resultado de uno, los demás se siguen procesando", async () => {
    const resueltos: number[] = [];
    const cola: ColaCorreos = {
      reclamar: async () => [correo(1), correo(2)],
      resolver: async (id) => { if (id === 1) throw new Error("no se pudo guardar"); resueltos.push(id); },
    };
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await procesarColaCon(cola, async () => null)).toEqual({ enviados: 2, fallidos: 0 });
    expect(resueltos).toEqual([2]);
    registro.mockRestore();
  });
});
