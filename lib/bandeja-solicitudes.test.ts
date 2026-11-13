import { describe, it, expect } from "vitest";
import { armarBandeja, DIAS_RECHAZADA, ESTADOS_NO_FINALIZADOS, type FilaSolicitud } from "./bandeja-solicitudes";

const fila = (id: number, estado: number, solicitante: number, fecha = "2026-11-10T12:00:00Z"): FilaSolicitud => ({
  IdSolicitud: id, Token: `token-${id}`, NumeroSolicitud: id, FechaSolicitud: fecha, EstadoSolicitud: estado,
  IdUsuarioSolicitante: solicitante, NombreBodega: "CUARTO FRIO", Solicitante: `Usuario ${solicitante}`, Motivo: null, FechaResolucion: null,
});
const ids = (r: ReturnType<typeof armarBandeja>) => r.items.map((i) => i.IdSolicitud);
const espera = (r: ReturnType<typeof armarBandeja>, id: number) => r.items.find((i) => i.IdSolicitud === id)?.espera;

const SOLICITANTE = { uid: 1, gestiona: false };
const GESTOR = { uid: 9, gestiona: true };

describe("armarBandeja", () => {
  it("las no finalizadas son Creada, Enviada, Aprobada, Recepción parcial y Aprobada parcialmente", () => {
    expect([...ESTADOS_NO_FINALIZADOS]).toEqual([0, 1, 2, 4, 6]);
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

describe("armarBandeja: solicitudes rechazadas recientes", () => {
  const AHORA = new Date("2026-11-13T15:00:00Z");
  const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000).toISOString();
  const rechazada = (id: number, solicitante: number, fechaResolucion: string | null, motivo: string | null = "Sin stock"): FilaSolicitud =>
    ({ ...fila(id, 5, solicitante), FechaResolucion: fechaResolucion, Motivo: motivo });
  const SIETE_DIAS = DIAS_RECHAZADA * 24 * 60;

  it("se queda 7 días", () => expect(DIAS_RECHAZADA).toBe(7));

  it("la rechazada propia aparece con su motivo, espera «Rechazada» y no pide acción", () => {
    const r = armarBandeja([rechazada(1, 1, hace(60))], SOLICITANTE, 10, AHORA);
    expect(ids(r)).toEqual([1]);
    expect(r.items[0]).toMatchObject({ espera: "Rechazada", propia: true, requiereAccion: false, Motivo: "Sin stock" });
  });

  it("a 6 días 23 h aparece; pasados 7 días ya no", () => {
    expect(ids(armarBandeja([rechazada(1, 1, hace(SIETE_DIAS - 60))], SOLICITANTE, 10, AHORA))).toEqual([1]);
    expect(ids(armarBandeja([rechazada(1, 1, hace(SIETE_DIAS + 1))], SOLICITANTE, 10, AHORA))).toEqual([]);
  });

  it("la rechazada ajena no se ve nunca, ni siquiera quien gestiona", () => {
    expect(armarBandeja([rechazada(1, 2, hace(60))], SOLICITANTE, 10, AHORA).total).toBe(0);
    expect(armarBandeja([rechazada(1, 2, hace(60))], GESTOR, 10, AHORA).total).toBe(0);
  });

  it("quien gestiona sí ve las suyas propias rechazadas", () => {
    expect(ids(armarBandeja([rechazada(1, 9, hace(60))], GESTOR, 10, AHORA))).toEqual([1]);
  });

  it("sin fecha de rechazo (rechazadas anteriores a la migración) o con fecha inválida no se muestra", () => {
    expect(armarBandeja([rechazada(1, 1, null), rechazada(2, 1, "no es fecha")], SOLICITANTE, 10, AHORA).total).toBe(0);
  });

  it("una rechazada anterior sin motivo (null) se muestra igual", () => {
    expect(armarBandeja([rechazada(1, 1, hace(60), null)], SOLICITANTE, 10, AHORA).items[0].Motivo).toBeNull();
  });

  it("se ordena con el resto por fecha de solicitud, después de lo que pide acción", () => {
    const r = armarBandeja([rechazada(1, 1, hace(60)), fila(2, 2, 1, "2026-11-01T00:00:00Z"), fila(3, 1, 1, "2026-11-12T00:00:00Z")], SOLICITANTE, 10, AHORA);
    expect(ids(r)).toEqual([2, 3, 1]); // 2 = Aprobada propia = por recepcionar (pide acción); luego por fecha de solicitud: 3 (12-nov) y 1 (10-nov)
  });
});

describe("armarBandeja: Aprobada parcialmente (estado 6)", () => {
  const ADMIN = { uid: 5, gestiona: true, admin: true };
  const parcial = (id: number, solicitante: number) => ({ ...fila(id, 6, solicitante), Motivo: "Falta stock" });

  it("la ve el solicitante dueño (esperando al Administrador, sin acción) y no la de otro", () => {
    const r = armarBandeja([parcial(1, 1), parcial(2, 2)], SOLICITANTE);
    expect(ids(r)).toEqual([1]);
    expect(r.items[0]).toMatchObject({ espera: "En espera de aprobación", requiereAccion: false, propia: true, Motivo: "Falta stock" });
  });

  it("quien gestiona sin ser Administrador la ve de todos «En seguimiento», sin acción", () => {
    const r = armarBandeja([parcial(1, 1), parcial(2, 9)], GESTOR);
    expect(ids(r).sort()).toEqual([1, 2]);
    expect(espera(r, 1)).toBe("En seguimiento");
    expect(espera(r, 2)).toBe("En espera de aprobación"); // la propia de quien gestiona
    expect(r.items.every((i) => !i.requiereAccion)).toBe(true);
  });

  it("el Administrador la ve «Por aprobar» y pide su acción, salvo la suya (esa espera a otro Administrador)", () => {
    const r = armarBandeja([parcial(1, 1), parcial(2, 5)], ADMIN);
    expect(espera(r, 1)).toBe("Por aprobar");
    expect(r.items.find((i) => i.IdSolicitud === 1)?.requiereAccion).toBe(true);
    expect(espera(r, 2)).toBe("En espera de aprobación");
    expect(r.items.find((i) => i.IdSolicitud === 2)?.requiereAccion).toBe(false);
  });

  it("sin la marca admin, un gestor no recibe «Por aprobar» (esa acción es solo del rol Administrador)", () => {
    expect(espera(armarBandeja([parcial(1, 1)], { uid: 5, gestiona: true }), 1)).toBe("En seguimiento");
  });

  it("la Cerrada (7) no aparece en la bandeja de nadie", () => {
    expect(armarBandeja([fila(1, 7, 1), fila(2, 7, 5)], ADMIN).total).toBe(0);
    expect(armarBandeja([fila(1, 7, 1)], SOLICITANTE).total).toBe(0);
  });
});
