import { z } from "zod";

export const MSG_MOTIVO_RECHAZO = "Indique el motivo del rechazo (máximo 100 caracteres)";

/** Motivo de un rechazo: texto de 1 a 100 caracteres, sin espacios ni saltos de línea en los extremos (igual que `rechazar_solicitud` en SQL). */
export const motivoRechazoSchema = z.string(MSG_MOTIVO_RECHAZO).trim().min(1, MSG_MOTIVO_RECHAZO).max(100, MSG_MOTIVO_RECHAZO);
