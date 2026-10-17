import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Las pruebas de SQL levantan una base PGlite por archivo y ejecutan todas las migraciones:
// con varios archivos en paralelo superan los 10 s por defecto aunque pasen por separado.
// El alias "@" (como en tsconfig) permite probar módulos del servidor con sus dependencias simuladas.
export default defineConfig({
  resolve: { alias: { "@": resolve(process.cwd()) } },
  test: { hookTimeout: 60_000, testTimeout: 30_000 },
});
