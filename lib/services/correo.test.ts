import { describe, it, expect, vi, beforeEach } from "vitest";

const insert = vi.fn(async () => ({ error: null }));
vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({ Resend: class {} }));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/db/supabase", () => ({ db: { from: () => ({ insert: (...a: unknown[]) => insert(...(a as [])) }) }, nulo: null }));

import { notificarResuelta } from "./correo";

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
