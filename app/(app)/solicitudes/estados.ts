export const ESTADOS: Record<number, string> = {
  0: "Creada", 1: "Enviada", 2: "Aprobada", 3: "Recepcionada", 4: "Recepción parcial", 5: "Rechazada",
};

/** Color de la insignia de cada estado (ver components/app/badge.tsx). */
export const ESTADO_TONO: Record<number, "ok" | "warn" | "danger" | "info" | "neutral"> = {
  0: "neutral", 1: "info", 2: "ok", 3: "ok", 4: "warn", 5: "danger",
};
