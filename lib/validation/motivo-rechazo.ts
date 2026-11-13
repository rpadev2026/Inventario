import { z } from "zod";

export const MSG_MOTIVO_RECHAZO = "Indique el motivo del rechazo (máximo 100 caracteres)";
export const MSG_MOTIVO_PARCIAL = "Indique el motivo de la aprobación parcial (máximo 100 caracteres)";
export const MSG_MOTIVO_CIERRE = "Indique el motivo del cierre (máximo 100 caracteres)";

/** Motivo de un rechazo, una aprobación parcial o un cierre: texto de 1 a 100 caracteres, sin espacios ni saltos de línea en los extremos (igual que en SQL). */
export const motivoSchema = (mensaje: string) => z.string(mensaje).trim().min(1, mensaje).max(100, mensaje);
export const motivoRechazoSchema = motivoSchema(MSG_MOTIVO_RECHAZO);
