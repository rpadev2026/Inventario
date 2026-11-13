import { describe, it, expect } from "vitest";
import { requisitosClave, validarPolitica } from "./password";

describe("requisitosClave", () => {
  it("lista todos los requisitos aunque la clave esté vacía, todos pendientes", () => {
    const r = requisitosClave("");
    expect(r.map((x) => x.texto)).toEqual([
      "Al menos 12 caracteres", "Una letra minúscula", "Una letra mayúscula", "Un número", "Un símbolo (por ejemplo ! ? # $ %)", "Como máximo 128 caracteres",
    ]);
    expect(r.filter((x) => x.cumple).map((x) => x.texto)).toEqual(["Como máximo 128 caracteres"]); // el máximo se cumple con vacío
  });

  it("marca cada requisito según la clave", () => {
    const cumple = (pw: string) => Object.fromEntries(requisitosClave(pw).map((x) => [x.texto, x.cumple]));
    expect(cumple("abcdefghijkl")).toMatchObject({ "Al menos 12 caracteres": true, "Una letra minúscula": true, "Una letra mayúscula": false, "Un número": false });
    expect(cumple("ABC1")).toMatchObject({ "Al menos 12 caracteres": false, "Una letra mayúscula": true, "Un número": true, "Una letra minúscula": false });
    expect(cumple("a".repeat(129))["Como máximo 128 caracteres"]).toBe(false);
  });

  it("el máximo se marca para mostrarse solo cuando falla", () => {
    expect(requisitosClave("x").find((x) => x.texto.startsWith("Como máximo"))?.soloSiFalla).toBe(true);
    expect(requisitosClave("x").filter((x) => x.soloSiFalla)).toHaveLength(1);
  });

  it("es consistente con validarPolitica: todos cumplidos ⇔ la política la acepta", () => {
    for (const pw of ["", "corta", "soloMinusculasyMAYUS", "Valida1234!xyz", "valida1234!xyz", "VALIDA1234!XYZ", "ValidaSinNumero!!", "Valida12345678", "Ab1!" + "x".repeat(130), "Clave Con Espacio 1!"])
      expect(requisitosClave(pw).every((x) => x.cumple), pw).toBe(validarPolitica(pw) === null);
  });
});
