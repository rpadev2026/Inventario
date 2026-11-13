import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BandejaSolicitudes from "./bandeja-solicitudes";
import type { ItemBandeja } from "@/lib/bandeja-solicitudes";

const AHORA = new Date("2026-11-13T15:00:00Z");
const item = (id: number, o: Partial<ItemBandeja> = {}): ItemBandeja => ({
  IdSolicitud: id, Token: `3a8c9632-90ee-452b-9fd1-d4098ec2bf4${id}`, NumeroSolicitud: 10 + id, FechaSolicitud: "2026-11-13T13:00:00Z", EstadoSolicitud: 1,
  IdUsuarioSolicitante: 1, NombreBodega: "CUARTO FRIO", Solicitante: "JORGE LOPEZ", MotivoRechazo: null, FechaResolucion: null, espera: "Por aprobar", propia: false, requiereAccion: true, ...o,
});
const html = (items: ItemBandeja[], total = items.length, extra: { error?: boolean } = {}) =>
  renderToStaticMarkup(<BandejaSolicitudes items={items} total={total} ahora={AHORA} {...extra} />);

describe("BandejaSolicitudes", () => {
  it("cada fila es un enlace a /solicitudes/<token> (nunca al id numérico) con N°, bodega, solicitante, estado y qué se espera", () => {
    const h = html([item(1)]);
    expect(h).toContain('href="/solicitudes/3a8c9632-90ee-452b-9fd1-d4098ec2bf41"');
    expect(h).not.toContain('href="/solicitudes/1"');
    expect(h).toContain("#11");
    expect(h).toContain("CUARTO FRIO");
    expect(h).toContain("JORGE LOPEZ");
    expect(h).toContain("Enviada"); // insignia del estado 1
    expect(h).toContain("Por aprobar");
  });

  it("si la solicitud es del propio usuario se muestra «yo» en vez de su nombre", () => {
    const h = html([item(2, { propia: true, Solicitante: "ANA ADMIN", espera: "En espera de aprobación", requiereAccion: false })]);
    expect(h).toContain("yo");
    expect(h).not.toContain("ANA ADMIN");
  });

  it("las filas que piden acción se marcan con clase y con texto para lectores de pantalla (el color no es la única señal)", () => {
    const con = html([item(1, { requiereAccion: true })]);
    expect(con).toContain("bandeja-accion");
    expect(con).toContain("Requiere su acción");
    const sin = html([item(2, { requiereAccion: false, espera: "En seguimiento" })]);
    expect(sin).not.toContain("bandeja-accion");
    expect(sin).not.toContain("Requiere su acción");
  });

  it("sin solicitudes muestra «No tienes solicitudes pendientes» y no ofrece «Ver todas»", () => {
    const h = html([], 0);
    expect(h).toContain("No tienes solicitudes pendientes");
    expect(h).not.toContain("Ver todas");
  });

  it("con más solicitudes que las mostradas, «Ver todas (N)» lleva a /solicitudes", () => {
    const h = html([item(1), item(2)], 12);
    expect(h).toContain("Ver todas (12)");
    expect(h).toContain('href="/solicitudes"');
  });

  it("si todas caben, «Ver todas» va sin cantidad", () => {
    const h = html([item(1)], 1);
    expect(h).toContain("Ver todas");
    expect(h).not.toContain("Ver todas (");
  });

  it("el título cuenta el total real", () => {
    expect(html([item(1)], 12)).toContain("Bandeja (12)");
  });

  it("la antigüedad se escribe relativa al reloj inyectado", () => {
    const cuando = (iso: string) => html([item(1, { FechaSolicitud: iso })]);
    expect(cuando("2026-11-13T14:59:40Z")).toContain("hace un momento");
    expect(cuando("2026-11-13T14:30:00Z")).toContain("hace 30 min");
    expect(cuando("2026-11-13T13:00:00Z")).toContain("hace 2 h");
    expect(cuando("2026-11-12T12:00:00Z")).toContain("ayer");
    expect(cuando("2026-11-10T12:00:00Z")).toContain("hace 3 d");
  });

  it("si la bandeja no se pudo cargar muestra un aviso y no una lista vacía engañosa", () => {
    const h = html([], 0, { error: true });
    expect(h).toContain('role="alert"');
    expect(h).toContain("No se pudo cargar la bandeja");
    expect(h).not.toContain("No tienes solicitudes pendientes");
  });

  it("una solicitud rechazada muestra su insignia «Rechazada» y el motivo", () => {
    const h = html([item(3, { EstadoSolicitud: 5, espera: "Rechazada", propia: true, requiereAccion: false, MotivoRechazo: "Sin stock en central", FechaResolucion: "2026-11-12T10:00:00Z" })]);
    expect(h).toContain("Rechazada");
    expect(h).toContain("Motivo: Sin stock en central");
    expect(h).toContain('href="/solicitudes/3a8c9632-90ee-452b-9fd1-d4098ec2bf43"');
  });

  it("el motivo se muestra como texto: un motivo con HTML no se inyecta", () => {
    const h = html([item(3, { EstadoSolicitud: 5, espera: "Rechazada", propia: true, requiereAccion: false, MotivoRechazo: "<b>x</b> & \"y\"" })]);
    expect(h).not.toContain("<b>x</b>");
    expect(h).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("una rechazada anterior sin motivo no muestra la línea «Motivo»", () => {
    const h = html([item(3, { EstadoSolicitud: 5, espera: "Rechazada", propia: true, requiereAccion: false, MotivoRechazo: null })]);
    expect(h).not.toContain("Motivo:");
  });

  it("las solicitudes que no están rechazadas no muestran línea de motivo", () => {
    expect(html([item(1)])).not.toContain("Motivo:");
  });
});
