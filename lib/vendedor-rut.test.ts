import { describe, it, expect } from "vitest";
import { vendedorVigenteEnOtro, type VendedorExistente } from "./vendedor-rut";

const V = (IdVendedor: number, IdProveedor: number, RazonSocial: string, IdEstado: number): VendedorExistente => ({ IdVendedor, IdProveedor, RazonSocial, IdEstado });

describe("vendedorVigenteEnOtro (un RUT solo puede estar vigente en un proveedor)", () => {
  it("sin otros registros no hay conflicto", () => {
    expect(vendedorVigenteEnOtro([], undefined)).toBeUndefined();
  });
  it("un registro vigente de otro proveedor es conflicto y se informa su proveedor", () => {
    const c = vendedorVigenteEnOtro([V(7, 2, "Proveedor Dos", 1)], undefined);
    expect(c).toMatchObject({ IdVendedor: 7, RazonSocial: "Proveedor Dos" });
  });
  it("un registro no vigente de otro proveedor NO es conflicto", () => {
    expect(vendedorVigenteEnOtro([V(7, 2, "Proveedor Dos", 0)], undefined)).toBeUndefined();
  });
  it("al editar, el propio registro no cuenta como conflicto", () => {
    expect(vendedorVigenteEnOtro([V(7, 2, "Proveedor Dos", 1)], 7)).toBeUndefined();
  });
  it("al editar, otro registro vigente distinto sí es conflicto", () => {
    expect(vendedorVigenteEnOtro([V(7, 2, "Proveedor Dos", 1), V(9, 3, "Proveedor Tres", 1)], 7)).toMatchObject({ IdVendedor: 9 });
  });
  it("mezcla: ignora los no vigentes y devuelve el vigente", () => {
    expect(vendedorVigenteEnOtro([V(1, 1, "Uno", 0), V(2, 2, "Dos", 1), V(3, 3, "Tres", 0)], undefined)).toMatchObject({ IdVendedor: 2 });
  });
});
