import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = join(__dirname, "..");
const cfg = JSON.parse(readFileSync(join(raiz, "vercel.json"), "utf8")) as { crons?: { path: string; schedule: string }[] };
const crons = cfg.crons ?? [];
const proxy = readFileSync(join(raiz, "proxy.ts"), "utf8");
const archivoRuta = (path: string) => join(raiz, "app", ...path.split("/").filter(Boolean), "route.ts");

describe("vercel.json: crons", () => {
  it("declara los tres: cierre de solicitudes caducadas, reintento de correos y sincronización de Fudo", () => {
    expect(crons.map((c) => c.path).sort()).toEqual(["/api/correos/procesar", "/api/fudo/sincronizar", "/api/solicitudes/cerrar-caducadas"]);
  });

  for (const c of crons) {
    describe(c.path, () => {
      it("apunta a una ruta que existe y acepta GET (Vercel Cron llama por GET)", () => {
        expect(existsSync(archivoRuta(c.path))).toBe(true);
        expect(readFileSync(archivoRuta(c.path), "utf8")).toMatch(/export const GET\b|export async function GET\b/);
      });

      it("corre una vez al día (el plan gratuito de Vercel no admite más): minuto y hora fijos, el resto en «*»", () => {
        const campos = c.schedule.split(" ");
        expect(campos).toHaveLength(5);
        expect(campos[0]).toMatch(/^\d{1,2}$/);
        expect(campos[1]).toMatch(/^\d{1,2}$/);
        expect(campos.slice(2)).toEqual(["*", "*", "*"]);
      });

      it("es pública en proxy.ts: se autentica con CRON_SECRET, no con la cookie de sesión", () => {
        expect(proxy).toContain(`"${c.path}"`);
      });
    });
  }

  it("no hay dos crons a la misma hora y minuto", () => {
    const horas = crons.map((c) => c.schedule);
    expect(new Set(horas).size).toBe(horas.length);
  });
});
