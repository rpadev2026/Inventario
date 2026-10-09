import { z } from "zod";
import { validarRut } from "./rut";
import { esCorreoValido, MSG_CORREO } from "./correo";

/** Alta de usuario (solo Administrador). */
export const crearUsuarioSchema = z.object({
  rut: z.string().refine(validarRut, "RUT inválido"),
  nombres: z.string().trim().min(1).max(100).transform((v) => v.toUpperCase()),
  apellidos: z.string().trim().min(1).max(100).transform((v) => v.toUpperCase()),
  correo: z.string().trim().toLowerCase().max(254).refine(esCorreoValido, MSG_CORREO),
  password: z.string().max(128),
  idRol: z.coerce.number().int().positive(),
});

/** Edición de los datos de un usuario (el RUT no se modifica). */
export const editarUsuarioSchema = z.object({
  id: z.coerce.number().int().positive(),
  nombres: z.string().trim().min(1, "Nombres requeridos").max(100).transform((v) => v.toUpperCase()),
  apellidos: z.string().trim().min(1, "Apellidos requeridos").max(100).transform((v) => v.toUpperCase()),
  correo: z.string().trim().toLowerCase().max(254).refine(esCorreoValido, MSG_CORREO),
  // Solo "0" o "1" exactos: z.coerce.number() convertiría un valor vacío en 0 y desactivaría al usuario.
  estado: z.string().regex(/^[01]$/, "Estado inválido").transform(Number),
});
