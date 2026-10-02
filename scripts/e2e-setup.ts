// Crea 4 usuarios de prueba (E2E) con claves aleatorias y las guarda en .env.e2e (ignorado por git).
// Uso: node --env-file=.env.local scripts/e2e-setup.ts
import { createClient } from "@supabase/supabase-js";
import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dvRut } from "../lib/validation/rut.ts";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const usuarios = [
  { clave: "COMPRAS", correo: "e2e.compras@example.test", rol: "Compras", cuerpo: "90000001" },
  { clave: "SOLICITANTE", correo: "e2e.solicitante@example.test", rol: "Solicitante", cuerpo: "90000002" },
  { clave: "BODEGA", correo: "e2e.bodega@example.test", rol: "Bodeguero Central", cuerpo: "90000003" },
  { clave: "ADMIN", correo: "e2e.admin@example.test", rol: "Administrador", cuerpo: "90000004" },
];

const lineas: string[] = [];
for (const u of usuarios) {
  const password = "E2e-" + randomBytes(9).toString("base64url") + "#9z";
  const rut = `${u.cuerpo}-${dvRut(u.cuerpo)}`;
  const { data: us, error } = await db.from("Usuarios")
    .upsert({ Rut: rut, Nombres: "E2E", Apellidos: u.rol, Correo: u.correo, IdEstado: 1 }, { onConflict: "Correo" })
    .select("IdUsuario").single();
  if (error) throw error;
  const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const);
  await db.from("Claves").upsert({ IdUsuario: us.IdUsuario, Password: hash, IdEstado: 1, DebeCambiar: false, IntentosFallidos: 0, BloqueadoHasta: null }, { onConflict: "IdUsuario" });
  const { data: rol } = await db.from("Roles").select("IdRol").eq("NombreRol", u.rol).single();
  await db.from("UsuariosRoles").upsert({ IdUsuario: us.IdUsuario, IdRol: rol!.IdRol, IdEstado: 1 }, { onConflict: "IdUsuario,IdRol" });
  lineas.push(`E2E_${u.clave}_CORREO=${u.correo}`, `E2E_${u.clave}_PASSWORD=${password}`);
}
writeFileSync(".env.e2e", lineas.join("\n") + "\n");
console.log("Usuarios E2E listos; credenciales en .env.e2e");
