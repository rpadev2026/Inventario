// Uso: npm run seed:admin -- <rut> <correo> <clave-temporal>
import { createClient } from "@supabase/supabase-js";
import argon2 from "argon2";
import { validarRut, normalizarRut } from "../lib/validation/rut.ts";
import { validarPolitica } from "../lib/validation/password.ts";
import { esCorreoValido, MSG_CORREO } from "../lib/validation/correo.ts";

const [rut, correo, clave] = process.argv.slice(2);
if (!rut || !correo || !clave) throw new Error("Uso: seed-admin <rut> <correo> <clave>");
if (!esCorreoValido(correo)) throw new Error(MSG_CORREO);
if (!validarRut(rut)) throw new Error("RUT inválido");
const err = validarPolitica(clave);
if (err) throw new Error(err);

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: u, error } = await db.from("Usuarios")
  .insert({ Rut: normalizarRut(rut), Nombres: "Administrador", Apellidos: "Sistema", Correo: correo.toLowerCase() })
  .select("IdUsuario").single();
if (error) throw error;
const hash = await argon2.hash(clave, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const);
await db.from("Claves").insert({ IdUsuario: u.IdUsuario, Password: hash, DebeCambiar: true });
await db.from("HistorialClaves").insert({ IdUsuario: u.IdUsuario, Password: hash });
const { data: rol } = await db.from("Roles").select("IdRol").eq("NombreRol", "Administrador").single();
await db.from("UsuariosRoles").insert({ IdUsuario: u.IdUsuario, IdRol: rol!.IdRol });
console.log("Administrador creado con ID", u.IdUsuario, "- deberá cambiar la clave al ingresar.");
