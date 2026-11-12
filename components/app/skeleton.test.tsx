import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PaginaCargando, { Skeleton, TablaCargando } from "./skeleton";

const cuenta = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe("esqueletos de carga", () => {
  it("la página en carga se anuncia una vez y se marca ocupada", () => {
    const html = renderToStaticMarkup(<PaginaCargando />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(cuenta(html, /Cargando…/g)).toBe(1);
    expect(html).toContain('class="sr-only"');
  });
  it("los bloques son decorativos (ocultos a lectores de pantalla)", () => {
    const html = renderToStaticMarkup(<Skeleton ancho="5rem" alto="2rem" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("width:5rem");
    expect(html).toContain("height:2rem");
  });
  it("la tabla tiene el encabezado y las filas pedidas", () => {
    const html = renderToStaticMarkup(<TablaCargando columnas={3} filas={4} />);
    expect(cuenta(html, /<th[ >]/g)).toBe(3);
    expect(cuenta(html, /<tr[ >]/g)).toBe(5); // encabezado + 4 filas
    expect(cuenta(html, /<td[ >]/g)).toBe(12);
  });
  it("cifras, filtros y tablas son opcionales", () => {
    const completa = renderToStaticMarkup(<PaginaCargando tarjetas={4} tablas={2} />);
    expect(cuenta(completa, /class="card space-y-2"/g)).toBe(4);
    expect(cuenta(completa, /<table/g)).toBe(2);
    expect(completa).toContain('class="card"'); // filtros
    const sinFiltros = renderToStaticMarkup(<PaginaCargando filtros={false} />);
    expect(sinFiltros).not.toContain("form-grid");
  });
});
