import { describe, it, expect, vi, beforeEach } from "vitest";

const insert = vi.fn(async () => ({ error: null }));
vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({ Resend: class {} }));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/db/supabase", () => ({ db: { from: () => ({ insert: (...a: unknown[]) => insert(...(a as [])) }) }, nulo: null }));

import { notificarCierre, notificarParcial, notificarResuelta } from "./correo";

const html = () => (insert.mock.calls[0] as unknown as [{ Html: string; Asunto: string; Para: string[] }])[0];
beforeEach(() => insert.mockClear());

describe("notificarResuelta", () => {
  it("rechazada con motivo: el correo incluye el motivo", async () => {
    await notificarResuelta(5, "beto@x.cl", false, "Sin stock");
    expect(html().Asunto).toBe("Solicitud #5 rechazada");
    expect(html().Html).toContain("Motivo: Sin stock");
  });
  it("el motivo se escapa: no puede inyectar HTML en el correo", async () => {
    await notificarResuelta(5, "beto@x.cl", false, `<img src=x onerror=1> & "x"`);
    expect(html().Html).not.toContain("<img");
    expect(html().Html).toContain("&lt;img src=x onerror=1&gt; &amp; &quot;x&quot;");
  });
  it("aprobada o rechazada sin motivo no agrega la línea de motivo", async () => {
    await notificarResuelta(5, "beto@x.cl", true, "ignorado");
    expect(html().Html).not.toContain("Motivo");
    insert.mockClear();
    await notificarResuelta(5, "beto@x.cl", false);
    expect(html().Html).not.toContain("Motivo");
  });
});

describe("notificarParcial", () => {
  it("avisa al solicitante con el motivo (escapado) y que queda pendiente del Administrador", async () => {
    await notificarParcial(5, "beto@x.cl", `<b>Falta</b> & "stock"`);
    const c = html();
    expect(c.Para).toEqual(["beto@x.cl"]);
    expect(c.Asunto).toBe("Solicitud #5 aprobada parcialmente");
    expect(c.Html).toContain("Administrador");
    expect(c.Html).toContain("&lt;b&gt;Falta&lt;/b&gt; &amp; &quot;stock&quot;");
    expect(c.Html).not.toContain("<b>Falta</b>");
  });
});

describe("notificarCierre", () => {
  it("un solo correo con todos los participantes como destinatarios, con el motivo escapado y clave única por solicitud", async () => {
    await notificarCierre(5, ["a@x.cl", "b@x.cl"], "<i>Cierre por caducidad de días</i>");
    const llamada = insert.mock.calls[0] as unknown as [{ Para: string[]; Asunto: string; Html: string; ClaveUnica: string }];
    expect(llamada[0].Para).toEqual(["a@x.cl", "b@x.cl"]);
    expect(llamada[0].Asunto).toBe("Solicitud #5 cerrada");
    expect(llamada[0].Html).toContain("&lt;i&gt;Cierre por caducidad de días&lt;/i&gt;");
    expect(llamada[0].ClaveUnica).toBe("cierre:5");
  });
  it("sin destinatarios no encola nada", async () => {
    await notificarCierre(5, [], "x");
    expect(insert).not.toHaveBeenCalled();
  });
});
