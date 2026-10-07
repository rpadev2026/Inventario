import { z } from "zod";

export const codigoCatalogo = z.string().trim().toUpperCase()
  .regex(/^[A-Z0-9_]{1,30}$/, "Código: solo letras, números y _ (máx. 30)");

const estado = z.coerce.number().pipe(z.union([z.literal(0), z.literal(1)])).default(1);

export const catalogoSchema = z.object({
  codigo: codigoCatalogo,
  nombre: z.string().trim().min(1, "Nombre requerido").max(80),
  estado,
});

export const MSG_FACTOR = "Factor: número mayor que 0 (hasta 6 decimales)";
/** Unidades de medida: unidad base (vacía = la misma unidad) y factor de conversión a ella. */
export const catalogoUnidadSchema = catalogoSchema.extend({
  unidadBase: z.string().trim().toUpperCase().max(30),
  factor: z.string().trim().regex(/^\d+([.,]\d{1,6})?$/, MSG_FACTOR)
    .transform((v) => Number(v.replace(",", ".")))
    .refine((n) => n > 0, MSG_FACTOR),
});
