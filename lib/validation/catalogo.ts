import { z } from "zod";

export const codigoCatalogo = z.string().trim().toUpperCase()
  .regex(/^[A-Z0-9_]{1,30}$/, "Código: solo letras, números y _ (máx. 30)");

const estado = z.coerce.number().pipe(z.union([z.literal(0), z.literal(1)])).default(1);

export const catalogoSchema = z.object({
  codigo: codigoCatalogo,
  nombre: z.string().trim().min(1, "Nombre requerido").max(80),
  estado,
});
