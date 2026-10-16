/** Identificador público (uuid) de un registro en la URL; cualquier otro valor se ignora. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const tokenValido = (v: unknown): string | undefined => (typeof v === "string" && UUID.test(v) ? v : undefined);
