import { describe, it, expect } from "vitest";
import { DIAS_CADUCIDAD, MOTIVO_CADUCIDAD, fechaCaducidad, hayCambioDeCantidades, motivoDeSolicitud } from "./aprobacion-parcial";

const items = [{ producto: 1, solicitada: 100 }, { producto: 2, solicitada: 50 }];

describe("hayCambioDeCantidades", () => {
  it("sin cambios (todo igual a lo solicitado) es false", () => {
    expect(hayCambioDeCantidades(items, { "1": "100", "2": "50" })).toBe(false);
    expect(hayCambioDeCantidades(items, { "1": "100.000", "2": "50,0".replace(",", ".") })).toBe(false);
  });
  it("cualquier producto con otra cantidad es true", () => {
    expect(hayCambioDeCantidades(items, { "1": "40", "2": "50" })).toBe(true);
    expect(hayCambioDeCantidades(items, { "1": "100", "2": "0" })).toBe(true);
  });
  it("un valor vacío o no numérico cuenta como 0 (cambio)", () => {
    expect(hayCambioDeCantidades(items, { "1": "", "2": "50" })).toBe(true);
    expect(hayCambioDeCantidades(items, { "1": "abc", "2": "50" })).toBe(true);
  });
  it("un producto sin valor en el formulario cuenta como 0", () => {
    expect(hayCambioDeCantidades(items, { "1": "100" })).toBe(true);
  });
  it("se compara con lo SOLICITADO, no con el máximo que permite el stock", () => {
    expect(hayCambioDeCantidades([{ producto: 1, solicitada: 100 }], { "1": "60" })).toBe(true); // aunque 60 fuera el máximo disponible
  });
  it("sin productos no hay cambio", () => expect(hayCambioDeCantidades([], {})).toBe(false));
});

describe("fechaCaducidad", () => {
  it("son 7 días desde la aprobación parcial", () => {
    expect(DIAS_CADUCIDAD).toBe(7);
    expect(fechaCaducidad("2026-11-13T15:00:00Z").toISOString()).toBe("2026-11-20T15:00:00.000Z");
  });
});

describe("motivoDeSolicitud", () => {
  const r = { MotivoRechazo: "Sin stock", MotivoParcial: "Falta stock", MotivoCierre: "Ya no se necesita" };
  it("devuelve el motivo que corresponde al estado", () => {
    expect(motivoDeSolicitud({ EstadoSolicitud: 5, ...r })).toBe("Sin stock");
    expect(motivoDeSolicitud({ EstadoSolicitud: 6, ...r })).toBe("Falta stock");
    expect(motivoDeSolicitud({ EstadoSolicitud: 7, ...r })).toBe("Ya no se necesita");
  });
  it("los demás estados no tienen motivo, aunque la fila conserve uno de un estado anterior (parcial → aprobada)", () => {
    for (const e of [0, 1, 2, 3, 4]) expect(motivoDeSolicitud({ EstadoSolicitud: e, ...r })).toBeNull();
  });
  it("un motivo ausente (rechazadas anteriores a 0048) es null", () => {
    expect(motivoDeSolicitud({ EstadoSolicitud: 5, MotivoRechazo: null, MotivoParcial: null, MotivoCierre: null })).toBeNull();
  });
});

describe("MOTIVO_CADUCIDAD", () => {
  it("es el motivo que pidió el usuario", () => expect(MOTIVO_CADUCIDAD).toBe("Cierre por caducidad de días"));
});
