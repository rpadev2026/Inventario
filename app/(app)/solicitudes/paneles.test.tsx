import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("./actions", () => ({ aprobarSolicitud: vi.fn(), aprobarParcialSolicitud: vi.fn(), recepcionarSolicitud: vi.fn(), reaprobarSolicitud: vi.fn(), cerrarSolicitud: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { PanelAprobar } from "./paneles";
import AccionesParcial from "./acciones-parcial";

const items = (inicial: number) => [{ producto: 1, nombre: "HARINA", max: 100, inicial, solicitada: 100 }];
const boton = (h: string, texto: string) => h.match(new RegExp(`<button[^>]*>[^<]*${texto}[^<]*</button>`))?.[0] ?? "";

describe("PanelAprobar", () => {
  it("con todo igual a lo solicitado: «Aprobar» activo y «Aprobar parcialmente» desactivado", () => {
    const h = renderToStaticMarkup(<PanelAprobar id={5} items={items(100)} />);
    expect(boton(h, "Aprobar")).not.toContain("disabled");
    expect(boton(h, "Aprobar parcialmente")).toContain("disabled");
  });

  it("si el stock ya limita lo aprobado por debajo de lo solicitado, «Aprobar» queda desactivado y se pide motivo", () => {
    const h = renderToStaticMarkup(<PanelAprobar id={5} items={items(60)} />);
    expect(h).toContain("Motivo de la aprobación parcial");
    expect(boton(h, "Aprobar")).toContain("disabled"); // el primer botón es «Aprobar» (total)
    expect(boton(h, "Aprobar parcialmente")).toContain("disabled"); // sin motivo todavía
  });

  it("el motivo tiene etiqueta visible, tope de 100 caracteres y contador", () => {
    const h = renderToStaticMarkup(<PanelAprobar id={5} items={items(100)} />);
    expect(h).toContain("Motivo de la aprobación parcial");
    expect(h).toContain('maxLength="100"');
    expect(h).toContain("0/100");
  });
});

describe("AccionesParcial (solo se muestra al Administrador)", () => {
  it("ofrece Aprobar y Cerrar con motivo obligatorio de hasta 100 caracteres", () => {
    const h = renderToStaticMarkup(<AccionesParcial id={5} puedeAprobar />);
    expect(h).toContain("Aprobar");
    expect(h).toContain("Cerrar solicitud");
    expect(h).toContain("Motivo del cierre");
    expect(h).toContain('maxLength="100"');
    expect(h).toContain("required");
  });
  it("si la solicitud es suya no ofrece Aprobar (solo Cerrar) y lo explica", () => {
    const h = renderToStaticMarkup(<AccionesParcial id={5} puedeAprobar={false} />);
    expect(h).toContain("otro Administrador");
    expect(h).toContain("Cerrar solicitud");
    expect(boton(h, "Aprobar solicitud")).toBe("");
  });
});
