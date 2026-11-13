import { describe, it, expect } from "vitest";
import { armarBandeja, ESTADOS_NO_FINALIZADOS, type FilaSolicitud } from "./bandeja-solicitudes";

const fila = (id: number, estado: number, solicitante: number, fecha = "2026-11-10T12:00:00Z"): FilaSolicitud => ({
  IdSolicitud: id, Token: `token-${id}`, NumeroSolicitud: id, FechaSolicitud: fecha, EstadoSolicitud: estado,
  IdUsuarioSolicitante: solicitante, NombreBodega: "CUARTO FRIO", Solicitante: `Usuario ${solicitante}`,
});
const ids = (r: ReturnType<typeof armarBandeja>) => r.items.map((i) => i.IdSolicitud);
const espera = (r: ReturnType<typeof armarBandeja>, id: number) => r.items.find((i) => i.IdSolicitud === id)?.espera;

const SOLICITANTE = { uid: 1, gestiona: false };
const GESTOR = { uid: 9, gestiona: true };

describe("armarBandeja", () => {
  it("las no finalizadas son Creada, Enviada, Aprobada y Recepción parcial", () => {
    expect([...ESTADOS_NO_FINALIZADOS]).toEqual([0, 1, 2, 4]);
  });

  it("descarta Recepcionada (3) y Rechazada (5), para el solicitante y para quien gestiona", () => {
    expect(armarBandeja([fila(1, 3, 1), fila(2, 5, 1)], SOLICITANTE)).toEqual({ items: [], total: 0 });
    expect(armarBandeja([fila(1, 3, 1), fila(2, 5, 2), fila(3, 3, 9), fila(4, 5, 9)], GESTOR)).toEqual({ items: [], total: 0 });
  });

  it("solicitante: solo ve las suyas en 0, 1, 2 y 4, aunque le pasen ajenas", () => {
    const r = armarBandeja([fila(1, 0, 1), fila(2, 1, 1), fila(3, 2, 1), fila(4, 4, 1), fila(5, 1, 2), fila(6, 2, 2), fila(7, 0, 2)], SOLICITANTE);
    expect(ids(r).sort()).toEqual([1, 2, 3, 4]);
    expect(espera(r, 1)).toBe("Borrador");
    expect(espera(r, 2)).toBe("En espera de aprobación");
    expect(espera(r, 3)).toBe("Por recepcionar");
    expect(espera(r, 4)).toBe("Por recepcionar");
    expect(r.items.every((i) => i.propia)).toBe(true);
  });

  it("gestiona: Enviadas ajenas son «Por aprobar» y Aprobadas o Parciales ajenas son «En seguimiento»", () => {
    const r = armarBandeja([fila(1, 1, 1), fila(2, 2, 1), fila(3, 4, 2)], GESTOR);
    expect(espera(r, 1)).toBe("Por aprobar");
    expect(espera(r, 2)).toBe("En seguimiento");
    expect(espera(r, 3)).toBe("En seguimiento");
    const accion = r.items.filter((i) => i.requiereAccion).map((i) => i.IdSolicitud);
    expect(accion).toEqual([1]); // solo «Por aprobar» pide acción de quien gestiona entre estas
  });

  it("requiereAccion es verdadero solo en «Por aprobar» y «Por recepcionar»", () => {
    const r = armarBandeja([fila(1, 0, 9), fila(2, 1, 9), fila(3, 2, 9), fila(4, 1, 1), fila(5, 2, 1)], GESTOR);
    const por = Object.fromEntries(r.items.map((i) => [i.IdSolicitud, [i.espera, i.requiereAccion]]));
    expect(por[1]).toEqual(["Borrador", false]);
    expect(por[2]).toEqual(["En espera de aprobación", false]);
    expect(por[3]).toEqual(["Por recepcionar", true]);
    expect(por[4]).toEqual(["Por aprobar", true]);
    expect(por[5]).toEqual(["En seguimiento", false]);
  });

  it("gestiona: no ve los borradores ajenos, pero sí los propios", () => {
    const r = armarBandeja([fila(1, 0, 1), fila(2, 0, 9)], GESTOR);
    expect(ids(r)).toEqual([2]);
    expect(espera(r, 2)).toBe("Borrador");
  });

  it("gestiona: su propia Enviada es «En espera de aprobación», no «Por aprobar» (nadie aprueba la suya)", () => {
    const r = armarBandeja([fila(1, 1, 9)], GESTOR);
    expect(espera(r, 1)).toBe("En espera de aprobación");
    expect(r.items[0].requiereAccion).toBe(false);
  });

  it("orden: primero lo que pide acción; dentro de cada grupo, la más reciente primero y, con la misma fecha, el mayor id", () => {
    const r = armarBandeja([
      fila(1, 2, 2, "2026-11-12T10:00:00Z"), // seguimiento, la más nueva
      fila(2, 1, 3, "2026-11-01T10:00:00Z"), // por aprobar, vieja
      fila(3, 1, 4, "2026-11-05T10:00:00Z"), // por aprobar, más nueva
      fila(4, 1, 5, "2026-11-05T10:00:00Z"), // por aprobar, misma fecha que la 3 → va antes por id
      fila(5, 2, 6, "2026-11-02T10:00:00Z"), // seguimiento, más vieja
    ], GESTOR);
    expect(ids(r)).toEqual([4, 3, 2, 1, 5]);
  });

  it("límite: con 12 pendientes devuelve 10 y el total real", () => {
    const filas = Array.from({ length: 12 }, (_, i) => fila(i + 1, 1, 1));
    const r = armarBandeja(filas, SOLICITANTE);
    expect(r.items).toHaveLength(10);
    expect(r.total).toBe(12);
  });

  it("el límite se puede cambiar", () => {
    const filas = Array.from({ length: 5 }, (_, i) => fila(i + 1, 1, 1));
    expect(armarBandeja(filas, SOLICITANTE, 3).items).toHaveLength(3);
  });

  it("sin filas: items vacío y total 0", () => {
    expect(armarBandeja([], GESTOR)).toEqual({ items: [], total: 0 });
  });

  it("conserva los datos de la fila para poder enlazar por token", () => {
    const [item] = armarBandeja([fila(7, 1, 1)], SOLICITANTE).items;
    expect(item).toMatchObject({ IdSolicitud: 7, Token: "token-7", NumeroSolicitud: 7, NombreBodega: "CUARTO FRIO", Solicitante: "Usuario 1", propia: true });
  });
});
