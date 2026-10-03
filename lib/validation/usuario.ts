import { z } from "zod";
import { validarRut } from "./rut";
import { esCorreoValido, MSG_CORREO } from "./correo";

/** Alta de usuario (solo Administrador). */
export const crearUsuarioSchema = z.object({
  rut: z.string().refine(validarRut, "RUT inválido"),
  nombres: z.string().trim().min(1).max(100),
  apellidos: z.string().trim().min(1).max(100),
  correo: z.string().trim().toLowerCase().max(254).refine(esCorreoValido, MSG_CORREO),
  password: z.string().max(128),
  idRol: z.coerce.number().int().positive(),
});
