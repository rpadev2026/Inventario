import { describe, it, expect, vi, beforeEach } from "vitest";

const leerSesion = vi.fn();
vi.mock("@/lib/auth/session", () => ({ leerSesion: () => leerSesion() }));
import { POST } from "./route";

describe("POST /api/sesion/actividad", () => {
  beforeEach(() => leerSesion.mockReset());
  it("204 sin contenido si la sesión sigue vigente", async () => {
    leerSesion.mockResolvedValue({ uid: 1, roles: [], permisos: [], cambiar: false });
    const r = await POST();
    expect(r.status).toBe(204);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
  it("401 si la sesión ya no vale (usuario desactivado, clave cambiada, token revocado)", async () => {
    leerSesion.mockResolvedValue(null);
    expect((await POST()).status).toBe(401);
  });
});
