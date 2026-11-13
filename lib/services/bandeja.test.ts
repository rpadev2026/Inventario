import { describe, it, expect, vi, beforeEach } from "vitest";

type Llamada = [string, ...unknown[]];
const llamadas: Llamada[] = [];
let filasSimuladas: unknown[] = [];
let errorSimulado: { message: string } | null = null;
let conteoSimulado: number | null = null;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/supabase", () => {
  // Constructor de consultas falso: registra cada llamada encadenada y responde al llegar a `limit`.
  const constructor = {
    select: (cols: string, o?: unknown) => { llamadas.push(["select", cols, o]); return constructor; },
    eq: (c: string, v: unknown) => { llamadas.push(["eq", c, v]); return constructor; },
    in: (c: string, v: unknown) => { llamadas.push(["in", c, v]); return constructor; },
    or: (f: string) => { llamadas.push(["or", f]); return constructor; },
    order: (c: string, o: unknown) => { llamadas.push(["order", c, o]); return constructor; },
    limit: async (n: number) => { llamadas.push(["limit", n]); return { data: errorSimulado ? null : filasSimuladas, error: errorSimulado, count: conteoSimulado }; },
  };
  return { db: { from: (t: string) => { llamadas.push(["from", t]); return constructor; } } };
});

import { cargarBandeja } from "./bandeja";

const filaDb = (id: number, estado: number, solicitante: number) => ({
  IdSolicitud: id, Token: `token-${id}`, NumeroSolicitud: id, FechaSolicitud: "2026-11-10T12:00:00Z", EstadoSolicitud: estado,
  IdUsuarioSolicitante: solicitante, Bodegas: { NombreBodega: "CUARTO FRIO" }, Usuarios: { Nombres: "JORGE", Apellidos: "LOPEZ" },
});
const llamada = (op: string) => llamadas.filter((l) => l[0] === op);

beforeEach(() => { llamadas.length = 0; filasSimuladas = []; errorSimulado = null; conteoSimulado = null; });

describe("cargarBandeja", () => {
  it("solicitante: pide solo las suyas (IdUsuarioSolicitante = uid) en estados 0, 1, 2 y 4, sin filtro .or", async () => {
    await cargarBandeja({ uid: 1, gestiona: false });
    expect(llamada("from")).toEqual([["from", "Solicitudes"]]);
    expect(llamada("eq")).toContainEqual(["eq", "IdUsuarioSolicitante", 1]);
    expect(llamada("in")).toContainEqual(["in", "EstadoSolicitud", [0, 1, 2, 4]]);
    expect(llamada("or")).toEqual([]);
  });

  it("gestiona: pide las Enviadas, Aprobadas y Parciales de todos y solo sus propios borradores", async () => {
    await cargarBandeja({ uid: 9, gestiona: true });
    expect(llamada("or")).toEqual([["or", "EstadoSolicitud.in.(1,2,4),and(IdUsuarioSolicitante.eq.9,EstadoSolicitud.eq.0)"]]);
    expect(llamada("eq").some((l) => l[1] === "IdUsuarioSolicitante")).toBe(false);
  });

  it("la consulta está acotada: más recientes primero y como máximo 200 filas", async () => {
    await cargarBandeja({ uid: 1, gestiona: false });
    expect(llamada("order")).toEqual([["order", "IdSolicitud", { ascending: false }]]);
    expect(llamada("limit")).toEqual([["limit", 200]]);
  });

  it("trae bodega y solicitante, con el nombre de la FK hacia Usuarios (Solicitudes tiene varias)", async () => {
    await cargarBandeja({ uid: 1, gestiona: false });
    const cols = String(llamada("select")[0][1]);
    expect(cols).toContain("Bodegas!inner(NombreBodega)");
    expect(cols).toContain("Usuarios!Solicitudes_IdUsuarioSolicitante_fkey!inner(Nombres,Apellidos)");
    expect(cols).toContain("Token");
  });

  it("convierte las filas de la base al formato de la bandeja y las clasifica", async () => {
    filasSimuladas = [filaDb(5, 1, 1), filaDb(6, 3, 1)]; // la 6 está Recepcionada: no aparece
    const r = await cargarBandeja({ uid: 1, gestiona: false });
    expect(r.total).toBe(1);
    expect(r.items[0]).toMatchObject({
      IdSolicitud: 5, Token: "token-5", NombreBodega: "CUARTO FRIO", Solicitante: "JORGE LOPEZ", espera: "En espera de aprobación", propia: true,
    });
  });

  it("quien gestiona recibe primero las Enviadas (estado 1) aunque haya cientos de solicitudes más nuevas en seguimiento", async () => {
    await cargarBandeja({ uid: 9, gestiona: true });
    expect(llamada("order")[0]).toEqual(["order", "EstadoSolicitud", { ascending: true }]);
    expect(llamada("order")[1]).toEqual(["order", "IdSolicitud", { ascending: false }]);
  });

  it("el total sale del conteo exacto de la base, no de las 200 filas traídas", async () => {
    conteoSimulado = 350;
    filasSimuladas = [filaDb(5, 1, 1)];
    await cargarBandeja({ uid: 1, gestiona: false });
    expect(llamada("select")[0][2]).toEqual({ count: "exact" });
    const r = await cargarBandeja({ uid: 1, gestiona: false });
    expect(r.total).toBe(350);
  });

  it("un error de la base se informa con un mensaje de negocio, sin filtrar el detalle", async () => {
    errorSimulado = { message: "relation \"Solicitudes\" does not exist" };
    await expect(cargarBandeja({ uid: 1, gestiona: false })).rejects.toThrow("No se pudo cargar la bandeja de solicitudes");
  });

  it("un uid que no es un entero positivo se rechaza antes de armar el filtro (no se interpola en el .or)", async () => {
    for (const uid of [Number.NaN, 1.5, -3, 0, Infinity]) {
      await expect(cargarBandeja({ uid, gestiona: true })).rejects.toThrow("No se pudo cargar la bandeja de solicitudes");
    }
    expect(llamadas).toEqual([]); // ni siquiera se consultó la base
  });
});
