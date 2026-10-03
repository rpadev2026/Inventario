import { defineConfig } from "vitest/config";

// Las pruebas de SQL levantan una base PGlite por archivo y ejecutan todas las migraciones:
// con varios archivos en paralelo superan los 10 s por defecto aunque pasen por separado.
export default defineConfig({
  test: { hookTimeout: 60_000, testTimeout: 30_000 },
});
