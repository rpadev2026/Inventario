import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = join(__dirname, "..");
const cfg = JSON.parse(readFileSync(join(raiz, "vercel.json"), "utf8")) as { crons?: { path: string; schedule: string }[] };

describe("vercel.json: cron del cierre por caducidad", () => {
  const cron = cfg.crons?.find((c) => c.path === "/api/solicitudes/cerrar-caducadas");

  it("declara el cron de las solicitudes aprobadas parcialmente", () => expect(cron).toBeDefined());

  it("apunta a una ruta que existe y acepta GET (Vercel Cron llama por GET)", () => {
    const ruta = join(raiz, "app", "api", "solicitudes", "cerrar-caducadas", "route.ts");
    expect(existsSync(ruta)).toBe(true);
    expect(readFileSync(ruta, "utf8")).toMatch(/export const GET\b/);
  });

  it("corre una vez al día (el plan gratuito de Vercel no admite más): minuto y hora fijos, el resto en «*»", () => {
    const [min, hora, dia, mes, semana] = cron!.schedule.split(" ");
    expect(cron!.schedule.split(" ")).toHaveLength(5);
    expect(min).toMatch(/^\d{1,2}$/);
    expect(hora).toMatch(/^\d{1,2}$/);
    expect([dia, mes, semana]).toEqual(["*", "*", "*"]);
  });

  it("la ruta es pública en proxy.ts: se autentica con CRON_SECRET, no con la cookie de sesión", () => {
    expect(readFileSync(join(raiz, "proxy.ts"), "utf8")).toContain("/api/solicitudes/cerrar-caducadas");
  });
});
