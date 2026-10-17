import { describe, it, expect } from "vitest";
import { ipCliente } from "./ip";

const h = (xff?: string) => ({ get: (k: string) => (k === "x-forwarded-for" ? (xff ?? null) : null) });

describe("ipCliente (límite de login por IP)", () => {
  it("con un proxy de confianza toma el valor que ese proxy agregó (el de la derecha)", () => {
    expect(ipCliente(h("203.0.113.9"), 1)).toBe("203.0.113.9");
    expect(ipCliente(h("198.51.100.7, 203.0.113.9"), 1)).toBe("203.0.113.9");
  });
  // Regresión (auditoría de seguridad): el valor de la izquierda lo elige el cliente; rotarlo daba un contador nuevo por intento.
  it("un cliente no puede cambiar su contador falsificando valores a la izquierda", () => {
    const real = "203.0.113.9";
    const claves = new Set([1, 2, 3, 4, 5].map((i) => ipCliente(h(`10.0.0.${i}, ${real}`), 1)));
    expect(claves).toEqual(new Set([real]));
  });
  it("con N proxies toma el N-ésimo desde la derecha", () => {
    expect(ipCliente(h("falso, 198.51.100.7, 203.0.113.9"), 2)).toBe("198.51.100.7");
    expect(ipCliente(h("198.51.100.7"), 2)).toBe("198.51.100.7"); // cadena más corta que los saltos
  });
  it("con 0 proxies de confianza o sin cabecera usa el contador compartido 'local'", () => {
    expect(ipCliente(h("203.0.113.9"), 0)).toBe("local");
    expect(ipCliente(h(undefined), 1)).toBe("local");
    expect(ipCliente(h(""), 1)).toBe("local");
  });
  it("un valor que no es una IP no sirve de clave", () => {
    expect(ipCliente(h("<script>alert(1)</script>"), 1)).toBe("local");
    expect(ipCliente(h("x".repeat(500)), 1)).toBe("local");
  });
  it("acepta IPv6, IPv4 con puerto y normaliza mayúsculas", () => {
    expect(ipCliente(h("2001:DB8::1"), 1)).toBe("2001:db8::1");
    expect(ipCliente(h("203.0.113.9:51234"), 1)).toBe("203.0.113.9");
  });
  it("PROXY_CONFIABLES inválido vuelve a 1", () => {
    expect(ipCliente(h("198.51.100.7, 203.0.113.9"), Number.NaN)).toBe("203.0.113.9");
  });
});
